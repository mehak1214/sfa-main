import { LightningElement, api, track, wire } from 'lwc';
import getPicklistValues from '@salesforce/apex/SampleOrderController.getPicklistValues';
import getSampleProducts from '@salesforce/apex/SampleOrderController.getSampleProducts';
import createSampleOrder from '@salesforce/apex/SampleOrderController.createSampleOrder';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from 'lightning/navigation';

export default class SampleOrderCreator extends NavigationMixin(LightningElement) {

    @api recordId;
    @track order = {};
    @track lines = [];

    purposeOptions = [];
    unitOptions = [];
    products = [];

    @wire(getPicklistValues, {
        objectApiName: 'ibfsa__Sample_Order__c',
        fieldApiName: 'ibfsa__Purpose__c'
    })
    wiredPurpose({ data }) {
        if (data) {
            this.purposeOptions = data.map(v => ({ label: v, value: v }));
        }
    }

    @wire(getPicklistValues, {
        objectApiName: 'ibfsa__Sample_Order_Line__c',
        fieldApiName: 'ibfsa__UnitOfMeasure__c'
    })
    wiredUnits({ data }) {
        if (data) {
            this.unitOptions = data.map(v => ({ label: v, value: v }));
        }
    }

    @wire(getSampleProducts)
    wiredProducts({ data }) {
        if (data) {
            this.products = data.map(p => ({ label: p.Name, value: p.Id }));
        }
    }

    handleHeaderChange(event) {
        this.order[event.target.dataset.field] = event.target.value;
    }

    addLine() {
        this.lines = [...this.lines, { uid: Date.now().toString() }];
    }

    handleLineChange(event) {
        const idx = event.target.dataset.index;
        const field = event.target.dataset.field;
        this.lines[idx][field] = event.target.value;
    }

    removeLine(event) {
        const idx = event.target.dataset.index;
        this.lines.splice(idx, 1);
        this.lines = [...this.lines];
    }

    save() {
        const cleanLines = this.lines.map(l => {
            const copy = { ...l };
            delete copy.uid;
            return copy;
        });

        createSampleOrder({
            orderRec: this.order,
            parentId: this.recordId,
            lines: cleanLines
        })
        .then(res => {
            this.showToast('Success', 'Sample Order created', 'success');
            this[NavigationMixin.Navigate]({
                type: 'standard__recordPage',
                attributes: {
                    recordId: res.sampleOrderId,
                    actionName: 'view'
                }
            });
        })
        .catch(err => {
            this.showToast('Error', err.body.message, 'error');
        });
    }

    showToast(title, msg, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message: msg, variant }));
    }
}