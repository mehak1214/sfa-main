import { LightningElement, api, track, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

// Apex Imports
import getFranchiseAccounts from '@salesforce/apex/PlaceOrderController.getFranchiseAccounts';
import getDistributorAccounts from '@salesforce/apex/PlaceOrderController.getDistributorAccounts';
import getProductsByDistributor from '@salesforce/apex/PlaceOrderController.getProductsByDistributor';
import getSchemesByThresholdQuantity from '@salesforce/apex/PlaceOrderController.getSchemesByThresholdQuantity';
import placeOrder from '@salesforce/apex/PlaceOrderController.placeOrder';
import getAccountAddress from '@salesforce/apex/PlaceOrderController.getAccountAddress';

export default class PlaceOrder extends LightningElement {
    _franchiseId;
    @track currentStep = 1; 

    @track address = {
        shippingStreet: '', shippingCity: '', shippingState: '', shippingPostalCode: '', shippingCountry: '',
        billingStreet: '', billingCity: '', billingState: '', billingPostalCode: '', billingCountry: '', contactName:'', phone:''
    };

    @track isBillingSame = false;

    @track payment = {
        amount: 0, mode: 'Cash', cardNumber: '', cardHolder: '', cardExpiry: '', cardType: '', upiId: ''
    };

    @track products = [];
    @track franchiseOptions = [];
    @track distributorOptions = [];
    @track availableSchemes = [];
    
    selectedFranchise;
    selectedDistributor;
    selectedSchemeId = null;

    paymentModes = [{ label: 'Cash', value: 'Cash' }, { label: 'UPI', value: 'UPI' }, { label: 'Card', value: 'Card' }];
    cardOptions = [{ label: 'Visa', value: 'Visa' }, { label: 'MasterCard', value: 'MasterCard' }, { label: 'RuPay', value: 'RuPay'}];

    @api
    get franchiseId() { return this._franchiseId; }
    set franchiseId(value) {
        this._franchiseId = value;
        if (value) { this.selectedFranchise = value; }
    }

    get stepOne() { return this.currentStep === 1; }
    get stepTwo() { return this.currentStep === 2; }
    get stepThree() { return this.currentStep === 3; }
    get stepFour() { return this.currentStep === 4; }

    get isCard() { return this.payment.mode === 'Card'; }
    get isUPI() { return this.payment.mode === 'UPI'; }
    get isFranchiseLocked() { return !!this.franchiseId; }

    @wire(getFranchiseAccounts)
    wiredFranchises({ data }) {
        if (data) {
            this.franchiseOptions = data.map(acc => ({ label: acc.Name, value: acc.Id }));
            if (this.franchiseId) { this.selectedFranchise = this.franchiseId; }
        }
    }

    @wire(getDistributorAccounts)
    wiredDistributors({ data }) {
        if (data) this.distributorOptions = data.map(acc => ({ label: acc.Name, value: acc.Id }));
    }

    @wire(getProductsByDistributor, { distributorId: '$selectedDistributor' })
    wiredProducts({ data }) {
        if (data) {
            this.products = data.map(p => ({ ...p, quantity: 0, unitPrice: p.unitPrice || 0 }));
        } else {
            this.products = [];
        }
    }

    handleNext() {
        if (this.currentStep === 1) {
            const selectedItems = this.products.filter(p => p.quantity > 0);
            if (!this.selectedFranchise || selectedItems.length === 0) {
                this.showToast('Error', 'Ensure franchise is selected and products are added', 'error');
                return;
            }
            getAccountAddress({ accountId: this.selectedFranchise })
                .then(result => {
                    if (result) {
                        this.address = { ...this.address, ...result };
                        if (!result.billingStreet) {
                            this.isBillingSame = true;
                            this.handleSameAddress({ target: { checked: true } });
                        }
                    }
                });
            this.currentStep = 2;
        } else if (this.currentStep === 2) {
            this.payment.amount = parseFloat(this.computedTotalPriceDisplay) || 0;
            this.currentStep = 3;
        }
    }

    handlePrev() { this.currentStep -= 1; }

    handleFranchiseChange(event) { if (!this.isFranchiseLocked) this.selectedFranchise = event.detail.value; }
    handleDistributorChange(event) { this.selectedDistributor = event.detail.value; }

    handleAddressChange(event) {
        const field = event.target.name;
        this.address[field] = event.target.value;
        if (this.isBillingSame && field.startsWith('shipping')) {
            this.address[field.replace('shipping', 'billing')] = event.target.value;
        }
    }

    handleSameAddress(event) {
        this.isBillingSame = event.target.checked;
        if (this.isBillingSame) {
            this.address.billingStreet = this.address.shippingStreet;
            this.address.billingCity = this.address.shippingCity;
            this.address.billingState = this.address.shippingState;
            this.address.billingPostalCode = this.address.shippingPostalCode;
            this.address.billingCountry = this.address.shippingCountry;
        }
    }

    handlePaymentChange(event) { this.payment[event.target.name] = event.target.value;}
    
    // if(computedTotalPriceDisplay) }
    handleSummarySchemeChange(event) { this.selectedSchemeId = event.detail.value; }

    // Unified Quantity Logic
    handleSummaryQtyChange(event) {
        const productId = event.target.dataset.id;
        const newQty = parseInt(event.target.value, 10);
        this.updateQtyValue(productId, isNaN(newQty) ? 0 : newQty);
    }

    increaseQty(event) { this.updateQtyValue(event.target.dataset.id, 'inc'); }
    decreaseQty(event) { this.updateQtyValue(event.target.dataset.id, 'dec'); }

    updateQtyValue(productId, actionOrValue) {
        this.products = this.products.map(p => {
            if (p.productId === productId) {
                let qty = p.quantity;
                if (actionOrValue === 'inc') qty++;
                else if (actionOrValue === 'dec') qty--;
                else qty = actionOrValue;
                return { ...p, quantity: qty < 0 ? 0 : qty };
            }
            return p;
        });
        this.updateAvailableSchemes();
    }

    updateAvailableSchemes() {
        const totalQty = this.products.reduce((sum, p) => sum + (parseInt(p.quantity, 10) || 0), 0);
        if (totalQty === 0) {
            this.availableSchemes = [];
            this.selectedSchemeId = null;
            return;
        }
        getSchemesByThresholdQuantity({ thresholdQuantity: totalQty })
            .then((result) => {
                this.availableSchemes = result.map(scheme => ({
                    label: scheme.label + ' (' + scheme.discount + '% off)',
                    value: scheme.value,
                    discount: scheme.discount
                }));
                if (!this.availableSchemes.length) this.selectedSchemeId = null;
                else if (!this.selectedSchemeId) this.selectedSchemeId = this.availableSchemes[0].value;
            });
    }

    orderAmt;

    saveOrder() {
        const selectedItems = this.products.filter(p => p.quantity > 0).map(p => ({
            productId: p.productId, productName: p.productName, quantity: parseInt(p.quantity, 10), unitPrice: p.unitPrice
        }));

        this.orderAmt = this.computedTotalPriceDisplay;
        // if(this.computedTotalPriceDisplay <)
        // this.showToast('Error', 'Ensure franchise is selected and products are added', 'error');

        placeOrder({
            franchiseId: this.selectedFranchise,
            distributorId: this.selectedDistributor,
            selectedProducts: selectedItems,
            selectedSchemeId: this.selectedSchemeId ? String(this.selectedSchemeId) : null,
            addressData: this.address,
            paymentData: this.payment
        })
        .then((result) => {
           // this.showToast('Order Placed', 'Success', 'success');
           this.currentStep = 4;
            //this.dispatchEvent(new CustomEvent('ordercreated', { detail: { orderId: result } }));
           // this.currentStep = 1;
            this.products = this.products.map(p => ({ ...p, quantity: 0 }));
        })
        .catch(error => this.showToast('Error', error.body?.message || 'Error', 'error'));
    }

    get selectedItemsForSummary() {
        return this.products.filter(p => p.quantity > 0).map(p => {
            const qty = parseInt(p.quantity, 10) || 0;
            const unit = parseFloat(p.unitPrice) || 0;
            let disc = 0;
            if (this.selectedSchemeId) {
                const s = this.availableSchemes.find(x => x.value === this.selectedSchemeId);
                if (s) disc = parseFloat(s.discount) || 0;
            }
            const dAmt = qty * unit * (disc / 100);
            return {
                ...p,
                unitPriceDisplay: unit.toFixed(2),
                lineTotalDisplay: (qty * unit).toFixed(2),
                discountAmountDisplay: dAmt.toFixed(2),
                discountedTotalDisplay: ((qty * unit) - dAmt).toFixed(2),
                discountedTotal: (qty * unit) - dAmt,
                lineTotal: qty * unit,
                discountAmount: dAmt
            };
        });
    }

    get selectedItemsSubtotalDisplay() { return this.selectedItemsForSummary.reduce((s, i) => s + i.lineTotal, 0).toFixed(2); }
    get selectedItemsTotalDiscountDisplay() { return this.selectedItemsForSummary.reduce((s, i) => s + i.discountAmount, 0).toFixed(2); }
    get computedTotalPriceDisplay() { return this.selectedItemsForSummary.reduce((s, i) => s + i.discountedTotal, 0).toFixed(2); }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }
}