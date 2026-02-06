import { LightningElement, api } from 'lwc';
import checkInVisit from '@salesforce/apex/VisitController.checkInVisit';
import checkOutVisit from '@salesforce/apex/VisitController.checkOutVisit';

export default class VisitCard extends LightningElement {

    @api visit;

    get statusClass() {
        const status = this.visit.ibfsa__Visit_Status__c?.toLowerCase() || '';
        return `status ${status.replace(/\s/g, '')}`;
    }

    // Prevents the "Card Click" from firing when you click a button
    handleButtonContainerClick(event) {
        event.stopPropagation();
    }

    handleViewDetail() {
        // Navigates to the standard Salesforce Record Page
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: this.visit.Id,
                actionName: 'view'
            }
        });
    }

    get showCheckIn() {
        return this.visit.ibfsa__Visit_Status__c === 'Approved';
    }

    get showCheckOut() {
        return this.visit.ibfsa__Visit_Status__c === 'In Progress';
    }

    handleCheckIn() {
        navigator.geolocation.getCurrentPosition(pos => {
            checkInVisit({
                visitId: this.visit.Id,
                lat: pos.coords.latitude.toString(),
                lon: pos.coords.longitude.toString()
            });
        });
    }

    handleCheckOut() {
        navigator.geolocation.getCurrentPosition(pos => {
            checkOutVisit({
                visitId: this.visit.Id,
                lat: pos.coords.latitude.toString(),
                lon: pos.coords.longitude.toString()
            });
        });
    }
}