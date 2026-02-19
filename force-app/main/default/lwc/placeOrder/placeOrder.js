import { LightningElement, track, wire } from 'lwc';

import getFranchiseAccounts from '@salesforce/apex/PlaceOrderController.getFranchiseAccounts';
import getDistributorAccounts from '@salesforce/apex/PlaceOrderController.getDistributorAccounts';
import getProductsByDistributor from '@salesforce/apex/PlaceOrderController.getProductsByDistributor';
import placeOrderFull from '@salesforce/apex/PlaceOrderController.placeOrderFull';

import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class PlaceOrder extends LightningElement {


currentStep = "1";

get isStep1() { return this.currentStep === "1"; }
get isStep2() { return this.currentStep === "2"; }
get isStep3() { return this.currentStep === "3"; }

@track products = [];
@track franchiseOptions = [];
@track distributorOptions = [];

selectedFranchise;
selectedDistributor;

billingStreet;
billingCity;

shippingStreet;
shippingCity;

billToContactId;
shipToContactId;

paymentAmount = 0;
paymentMode = 'Cash';

paymentModeOptions = [
    { label: 'Cash', value: 'Cash' },
    { label: 'UPI', value: 'UPI' },
    { label: 'Card', value: 'Card' }
];


/* WIRES */

@wire(getFranchiseAccounts)
wiredFranchise({ data }) {
    if (data) {
        this.franchiseOptions = data.map(a => ({
            label: a.Name,
            value: a.Id
        }));
    }
}

@wire(getDistributorAccounts)
wiredDistributor({ data }) {
    if (data) {
        this.distributorOptions = data.map(a => ({
            label: a.Name,
            value: a.Id
        }));
    }
}

@wire(getProductsByDistributor, { distributorId: '$selectedDistributor' })
wiredProducts({ data }) {
    if (data) {
        this.products = data.map(p => ({
            ...p,
            quantity: 0
        }));
    }
}


/* STEP NAV */

goToStep1() { this.currentStep = "1"; }
goToStep2() { this.currentStep = "2"; }
goToStep3() { this.currentStep = "3"; }


/* HANDLERS */

handleFranchiseChange(e) { this.selectedFranchise = e.detail.value; }
handleDistributorChange(e) { this.selectedDistributor = e.detail.value; }

handleInputChange(e) {
    const field = e.target.dataset.field;
    this[field] = e.target.value;
}

handleBillContactChange(e) {
    this.billToContactId = e.detail.recordId;
}

handleShipContactChange(e) {
    this.shipToContactId = e.detail.recordId;
}

handlePaymentChange(e) {
    this.paymentAmount = parseFloat(e.target.value || 0);
}

handlePaymentModeChange(e) {
    this.paymentMode = e.detail.value;
}


/* QTY */

increaseQty(e) { this.updateQty(e.target.dataset.id, 1); }
decreaseQty(e) { this.updateQty(e.target.dataset.id, -1); }

updateQty(id, change) {

    this.products = this.products.map(p => {

        if (p.productId === id) {

            let qty = (p.quantity || 0) + change;

            return { ...p, quantity: qty < 0 ? 0 : qty };
        }

        return p;
    });
}


/* SUMMARY */

get selectedItemsForSummary() {

    return this.products
        .filter(p => p.quantity > 0)
        .map(p => {

            const qty = parseInt(p.quantity, 10) || 0;
            const price = parseFloat(p.unitPrice) || 0;

            return {
                ...p,
                lineTotal: qty * price,
                lineTotalDisplay: (qty * price).toFixed(2)
            };
        });
}

get computedTotalPrice() {

    return this.selectedItemsForSummary
        .reduce((sum, item) => sum + item.lineTotal, 0);
}

get computedTotalPriceDisplay() {
    return this.computedTotalPrice.toFixed(2);
}


/* SAVE */

saveOrder() {

    const selectedItems = this.selectedItemsForSummary.map(p => ({
        productId: p.productId,
        quantity: p.quantity,
        unitPrice: p.unitPrice
    }));

    placeOrderFull({

        franchiseId: this.selectedFranchise,
        distributorId: this.selectedDistributor,
        selectedProducts: selectedItems,

        billingStreet: this.billingStreet,
        billingCity: this.billingCity,

        shippingStreet: this.shippingStreet,
        shippingCity: this.shippingCity,

        billToContactId: this.billToContactId,
        shipToContactId: this.shipToContactId,

        paymentAmount: this.paymentAmount,
        paymentMode: this.paymentMode
    })
    .then(() => {

        this.showToast('Success', 'Order Created Successfully', 'success');
        this.currentStep = "1";

    })
    .catch(error => {

        this.showToast(
            'Error',
            error.body?.message || error.message,
            'error'
        );
    });
}


showToast(title, message, variant) {

    this.dispatchEvent(
        new ShowToastEvent({
            title,
            message,
            variant
        })
    );
}


}