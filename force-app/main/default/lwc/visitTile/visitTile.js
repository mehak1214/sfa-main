import { LightningElement, api } from 'lwc';
export default class VisitTile extends LightningElement {

    @api visit;
    @api dayStarted;
    @api dayEnded;
    @api isToday;
    @api showConnector = false;

    /* =====================
       GETTERS
    ====================== */
    get outletName() {
        return this.visit?.ibfsa__Outlet__r?.Name || 'Unknown Outlet';
    }

    get outletAddress() {
        return this.visit?.ibfsa__Outlet__r?.ibfsa__Addresss__c || 'No Address Provided';
    }

    get visitStatus() {
        return this.visit?.ibfsa__Visit_Status__c || 'Unknown';
    }

    get statusKey() {
        const raw = (this.visit?.ibfsa__Visit_Status__c || '').trim().toLowerCase();
        const cleaned = raw.replace(/[^a-z]+/g, '-').replace(/(^-|-$)/g, '');
        return cleaned || 'unknown';
    }

    get statusBadgeClass() {
        return `status-badge ${this.statusKey}`;
    }

    get dotClass() {
        if (this.statusKey === 'completed') return 'dot done';
        if (this.statusKey === 'in-progress') return 'dot active';
        return 'dot';
    }

    get cardClass() {
        return `visit-card status-${this.statusKey}`;
    }

    get wrapperClass() {
        return `timeline-wrapper${this.showConnector ? '' : ' no-connector'}`;
    }

    /* =====================
       MAP (FIXED)
    ====================== */
    navigateToMap(event) {
        event?.stopPropagation();
        const outlet = this.visit?.ibfsa__Outlet__r;

        const lat = outlet?.ibfsa__Outlet_Location__Latitude__s;
        const lon = outlet?.ibfsa__Outlet_Location__Longitude__s;

        if (!lat || !lon) {
            alert('Outlet location not available');
            return;
        }

        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;

        // Works in Salesforce desktop + mobile
        window.open(mapUrl, '_blank');
    }

    handleCardClick() {
        this.dispatchEvent(
            new CustomEvent('openvisit', {
                detail: { visit: this.visit },
                bubbles: true,
                composed: true
            })
        );
    }

}