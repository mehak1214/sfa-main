// Import required base classes and decorators from LWC
import { LightningElement, track, wire } from 'lwc';

// Import Apex methods (backend calls)
import getFranchiseAccounts from '@salesforce/apex/PlaceOrderController.getFranchiseAccounts';
import getDealerDistributorAccounts from '@salesforce/apex/PlaceOrderController.getDealerDistributorAccounts';
import getProducts from '@salesforce/apex/PlaceOrderController.getProducts';
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
    wiredAccounts({ data }) {
        if (data) {
            this.franchiseOptions = data.map(acc => ({
                label: acc.Name,
                value: acc.Id
            }));
        }
    }

    // 🔹 Automatically calls Apex method to get dealer/distributor accounts
    @wire(getDealerDistributorAccounts)
    wiredDistributors({ data }) {
        if (data) {
            this.distributorOptions = data.map(acc => ({
                label: acc.Name,
                value: acc.Id
            }));
        }
    }

    // 🔹 Automatically calls Apex method to get products based on distributor selection
    @wire(getProductsByDistributor, { distributorId: '$selectedDistributor' })
    wiredProducts({ data }) {
        if (data) {
            this.products = data.map(p => ({
                ...p,
                quantity: 0,
                unitPrice: p.unitPrice == null ? 0 : p.unitPrice
            }));
        } else {
            // Reset products when no distributor selected
            this.products = [];
        }
    }

    // 🔹 Returns selected products (quantity > 0) with computed line totals
    get selectedItemsForSummary() {
        return this.products
            .filter(p => p.quantity > 0)
            .map(p => {
                const unit = Number(p.unitPrice || 0);
                const qty = Number(p.quantity || 0);
                const line = unit * qty;
                return {
                    productId: p.productId,
                    productName: p.productName,
                    quantity: qty,
                    unitPrice: unit,
                    lineTotal: line,
                    unitPriceDisplay: unit.toFixed(2),
                    lineTotalDisplay: line.toFixed(2)
                };
            });
    }

    // 🔹 Total price across selected products
    get computedTotalPrice() {
        return this.selectedItemsForSummary.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
    }

    // Formatted total price for display
    get computedTotalPriceDisplay() {
        return Number(this.computedTotalPrice || 0).toFixed(2);
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

        if (!this.selectedDistributor) {
            this.showToast('Error', 'Please select a dealer/distributor', 'error');
            return;
        }

        const selectedItems = this.products
            .filter(p => p.quantity > 0)
            .map(p => ({
                productId: p.productId || '',
                productName: p.productName || '',
                imageUrl: p.imageUrl || '',
                quantity: parseInt(p.quantity, 10) || 0
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
}