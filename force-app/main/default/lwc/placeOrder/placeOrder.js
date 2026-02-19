// Import required base classes and decorators from LWC
import { LightningElement, api, track, wire } from 'lwc';

// Import Apex methods for backend operations
import getFranchiseAccounts from '@salesforce/apex/PlaceOrderController.getFranchiseAccounts';
import getDistributorAccounts from '@salesforce/apex/PlaceOrderController.getDistributorAccounts';
import getProductsByDistributor from '@salesforce/apex/PlaceOrderController.getProductsByDistributor';
import getSchemesByThresholdQuantity from '@salesforce/apex/PlaceOrderController.getSchemesByThresholdQuantity';
import placeOrder from '@salesforce/apex/PlaceOrderController.placeOrder';

// Import toast event to display success/error notifications to the user
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

// Main component class definition
export default class PlaceOrder extends LightningElement {
    _franchiseId;

    // List of products displayed in the product selection section
    @track products = [];

    // Dropdown options for franchise accounts
    @track franchiseOptions = [];
    
    // Dropdown options for distributor accounts
    @track distributorOptions = [];

    // Stores the selected franchise Id from the dropdown
    selectedFranchise;

    @api
    get franchiseId() { 
        return this._franchiseId;
    }
    set franchiseId(value) {
        this._franchiseId = value;
        if (value) {
            this.selectedFranchise = value;
        }
    }
    
    // Stores the selected distributor Id from the dropdown
    selectedDistributor;
    
    // Array of applicable discount schemes for the current order
    @track availableSchemes = [];
    
    // Stores the currently selected scheme Id for applying discounts
    selectedSchemeId = null;

    // Wire adapter to automatically fetch franchise accounts from Salesforce
    @wire(getFranchiseAccounts)
    wiredFranchises({ data, error }) {
        if (data) {
            this.franchiseOptions = data.map(acc => ({
                label: acc.Name,
                value: acc.Id
            }));
            if (this.franchiseId) {
                this.selectedFranchise = this.franchiseId;
            }
        } else if (error) {
            this.showToast('Error', 'Unable to load Franchise accounts', 'error');
        }
    }

    // Wire adapter to automatically fetch distributor accounts from Salesforce
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

    // Wire adapter to fetch products for the selected distributor
    @wire(getProductsByDistributor, { distributorId: '$selectedDistributor' })
    wiredProducts({ data, error }) {
        if (data) {
            this.products = data.map(p => ({
                ...p,
                quantity: 0,
                unitPrice: p.unitPrice || 0
            }));
        } else if (error) {
            this.products = [];
            this.showToast('Error', 'Unable to load products for distributor', 'error');
        }
    }

    // Event handler for franchise dropdown selection change
    handleFranchiseChange(event) {
        if (this.isFranchiseLocked) {
            return;
        }
        this.selectedFranchise = event.detail.value;
    }

    // Event handler for distributor dropdown selection change
    handleDistributorChange(event) {
        this.selectedDistributor = event.detail.value;
    }

    // Event handler for increasing product quantity (clicking + button)
    increaseQty(event) {
        this.updateQty(event.target.dataset.id, 1);
    }

    // Event handler for decreasing product quantity (clicking - button)
    decreaseQty(event) {
        this.updateQty(event.target.dataset.id, -1);
    }

    // Generic function to update product quantities
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
        this.updateAvailableSchemes();
    }

    // Update available discount schemes based on total quantity of selected products
    updateAvailableSchemes() {
        // Calculate total quantity of selected products
        const totalQty = this.products.reduce((sum, p) => sum + (parseInt(p.quantity, 10) || 0), 0);
        
        if (totalQty === 0) {
            this.availableSchemes = [];
            this.selectedSchemeId = null;
            return;
        }

        // Fetch schemes from backend based on threshold quantity
        getSchemesByThresholdQuantity({ thresholdQuantity: totalQty })
            .then((result) => {
                this.availableSchemes = result.map(scheme => ({
                    label: scheme.label + ' (' + scheme.discount + '% off)',
                    value: scheme.value,
                    discount: scheme.discount
                }));
                // Auto-select the first (best) scheme when available schemes change
                if (this.availableSchemes.length > 0) {
                    this.selectedSchemeId = this.availableSchemes[0].value;
                } else {
                    this.selectedSchemeId = null;
                }
                console.log('Available schemes:', this.availableSchemes);
                console.log('Auto-selected scheme ID:', this.selectedSchemeId);
            })
            .catch((error) => {
                console.error('Error fetching schemes:', error);
                this.availableSchemes = [];
                this.selectedSchemeId = null;
            });
    }

    // Event handler for saving the order
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
                unitPrice: p.unitPrice || 0
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
            selectedProducts: selectedItems,
            selectedSchemeId: this.selectedSchemeId ? String(this.selectedSchemeId) : null
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
            this.selectedFranchise = this.franchiseId || undefined;
            this.selectedDistributor = undefined;
            this.availableSchemes = [];
            this.selectedSchemeId = null;
        })
        .catch(error => {
            const errorMsg = error.body?.message || error.message || 'An error occurred while creating the order';
            this.showToast('Error', errorMsg, 'error');
            console.error('Error placing order:', error);
        });
    }

    // Reusable helper method to display toast notifications to the user
    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant,
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
                let discount = 0;
                let discountAmount = 0;
                let discountedTotal = qty * unit;
                // If scheme selected, apply discount
                if (this.selectedSchemeId && this.availableSchemes.length) {
                    const sel = this.availableSchemes.find(s => s.value === this.selectedSchemeId);
                    if (sel && sel.discount) {
                        discount = parseFloat(sel.discount) || 0;
                        discountAmount = qty * unit * (discount / 100);
                        discountedTotal = qty * unit - discountAmount;
                    }
                }
                return {
                    productId: p.productId,
                    productName: p.productName,
                    quantity: qty,
                    unitPrice: unit,
                    unitPriceDisplay: unit.toFixed(2),
                    lineTotal: qty * unit,
                    lineTotalDisplay: (qty * unit).toFixed(2),
                    discount: discount,
                    discountAmount: discountAmount,
                    discountAmountDisplay: discountAmount.toFixed(2),
                    discountedTotal: discountedTotal,
                    discountedTotalDisplay: discountedTotal.toFixed(2)
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

    // Event handler for scheme selection in the summary section
    handleSummarySchemeChange(event) {
        this.selectedSchemeId = event.detail.value;
    }

    get isFranchiseLocked() {
        return !!this.franchiseId;
    }
}