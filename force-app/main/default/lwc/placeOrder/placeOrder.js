// Import required base classes and decorators from LWC
import { LightningElement, track, wire } from 'lwc';

/* Apex methods (backend calls) */
import getFranchiseAccounts from '@salesforce/apex/PlaceOrderController.getFranchiseAccounts';
import getDistributorAccounts from '@salesforce/apex/PlaceOrderController.getDistributorAccounts';
import getProductsByDistributor from '@salesforce/apex/PlaceOrderController.getProductsByDistributor';
import placeOrder from '@salesforce/apex/PlaceOrderController.placeOrder';

// Import toast event to show success/error messages
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

// Component class definition
export default class PlaceOrder extends LightningElement {

    // List of products (tracked so UI updates when data changes)
    @track products = [];

    // Franchise options for dropdown
    @track franchiseOptions = [];
    // Distributor options for dropdown
    @track distributorOptions = [];

    // Stores the selected franchise Id
    selectedFranchise;
    // Stores the selected distributor Id
    selectedDistributor;

    // 🔹 Automatically calls Apex method to get franchise accounts
    @wire(getFranchiseAccounts)
    wiredFranchises({ data, error }) {
        if (data) {
            this.franchiseOptions = data.map(acc => ({
                label: acc.Name,
                value: acc.Id
            }));
        } else if (error) {
            this.showToast('Error', 'Unable to load Franchise accounts', 'error');
        }
    }

    // 🔹 Automatically calls Apex method to get distributor accounts
    @wire(getDistributorAccounts)
    wiredDistributors({ data, error }) {
        if (data) {
            this.distributorOptions = data.map(acc => ({
                label: acc.Name,
                value: acc.Id
            }));
        } else if (error) {
            this.showToast('Error', 'Unable to load Distributor accounts', 'error');
        }
    }

        // 🔹 Automatically calls Apex method to get products for selected distributor
        @wire(getProductsByDistributor, { distributorId: '$selectedDistributor' })
        wiredProducts({ data, error }) {
            if (data) {
                this.products = data.map(p => ({
                    ...p,
                    quantity: 0,
                    unitPrice: p.unitPrice || 0,
                    schemes: p.schemes || [],
                    selectedSchemeId: null
                }));
            } else if (error) {
                this.products = [];
                this.showToast('Error', 'Unable to load products for distributor', 'error');
            }
        }

    // 🔹 Called when user selects a franchise from dropdown
    handleFranchiseChange(event) {
        this.selectedFranchise = event.detail.value;
    }

    // 🔹 Called when user selects a distributor from dropdown
    handleDistributorChange(event) {
        this.selectedDistributor = event.detail.value;
    }

    // 🔹 Called when + button is clicked
    increaseQty(event) {
        this.updateQty(event.target.dataset.id, 1);
    }

    // 🔹 Called when - button is clicked
    decreaseQty(event) {
        this.updateQty(event.target.dataset.id, -1);
    }

    // 🔹 Common function to update product quantity
    updateQty(productId, change) {
        this.products = this.products.map(p => {
            if (p.productId === productId) {
                let qty = p.quantity + change;
                return {
                    ...p,
                    quantity: qty < 0 ? 0 : qty
                };
            }
            return p;
        });
    }

    // 🔹 Called when user clicks Save Order button
    saveOrder() {
        if (!this.selectedFranchise) {
            this.showToast('Error', 'Please select a franchise', 'error');
            return;
        }

        const selectedItems = this.products
            .filter(p => p.quantity > 0)
            .map(p => ({
                productId: p.productId || '',
                productName: p.productName || '',
                imageUrl: p.imageUrl || '',
                quantity: parseInt(p.quantity, 10) || 0,
                unitPrice: p.unitPrice || 0,
                selectedSchemeId: p.selectedSchemeId ? String(p.selectedSchemeId) : null
            }));

        if (selectedItems.length === 0) {
            this.showToast('Error', 'Please select at least one product', 'error');
            return;
        }

        const invalidItems = selectedItems.filter(item => !item.productId);
        if (invalidItems.length > 0) {
            this.showToast('Error', 'Some products have invalid IDs', 'error');
            console.error('Invalid items:', invalidItems);
            return;
        }

        placeOrder({
            franchiseId: this.selectedFranchise,
            distributorId: this.selectedDistributor,
            selectedProducts: selectedItems
        })
        .then((result) => {
            this.showToast(
                'Success',
                'Order created successfully with ID: ' + result,
                'success'
            );
            this.products = this.products.map(p => ({
                ...p,
                quantity: 0
            }));
            this.selectedFranchise = undefined;
            this.selectedDistributor = undefined;
        })
        .catch(error => {
            const errorMsg = error.body?.message || error.message || 'An error occurred while creating the order';
            this.showToast('Error', errorMsg, 'error');
            console.error('Error placing order:', error);
        });
    }

    // 🔹 Reusable function to show toast messages (works on desktop & mobile)
    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant,
                //mode: 'sticky', // keeps toast visible until dismissed (good for mobile)
                duration: variant === 'success' ? 5000 : 10000
            })
        );
    }

    // ------------------ Summary Getters ------------------
    get selectedItemsForSummary() {
        return this.products
            .filter(p => p.quantity > 0)
            .map(p => {
                const qty = parseInt(p.quantity, 10) || 0;
                const unit = parseFloat(p.unitPrice) || 0;
                // find selected scheme to compute discount
                let discount = 0;
                let schemes = p.schemes || [];
                const sel = schemes.find(s => s.value === p.selectedSchemeId);
                if (sel && sel.discount) {
                    discount = parseFloat(sel.discount) || 0;
                }
                const subtotal = qty * unit;
                const discountAmount = subtotal * (discount / 100);
                const discountedTotal = subtotal - discountAmount;
                return {
                    productId: p.productId,
                    productName: p.productName,
                    quantity: qty,
                    unitPrice: unit,
                    unitPriceDisplay: unit.toFixed(2),
                    lineTotal: subtotal,
                    lineTotalDisplay: subtotal.toFixed(2),
                    discount: discount,
                    discountAmount: discountAmount,
                    discountAmountDisplay: discountAmount.toFixed(2),
                    discountedTotal: discountedTotal,
                    discountedTotalDisplay: discountedTotal.toFixed(2),
                    schemes: schemes,
                    selectedSchemeId: p.selectedSchemeId
                };
            });
    }

    get selectedItemsSubtotalDisplay() {
        const subtotal = this.selectedItemsForSummary.reduce((s, i) => s + (i.lineTotal || 0), 0);
        return subtotal.toFixed(2);
    }

    get selectedItemsTotalDiscountDisplay() {
        const totalDiscount = this.selectedItemsForSummary.reduce((s, i) => s + (i.discountAmount || 0), 0);
        return totalDiscount.toFixed(2);
    }

    get computedTotalPriceDisplay() {
        const total = this.selectedItemsForSummary.reduce((s, i) => s + (i.discountedTotal || 0), 0);
        return total.toFixed(2);
    }

    // 🔹 Called when user changes scheme in the summary combobox
    handleSummarySchemeChange(event) {
        const productId = event.target.dataset.id;
        const selectedSchemeId = event.detail.value;
        this.products = this.products.map(p => {
            if (p.productId === productId) {
                return {
                    ...p,
                    selectedSchemeId
                };
            }
            return p;
        });
    }
}