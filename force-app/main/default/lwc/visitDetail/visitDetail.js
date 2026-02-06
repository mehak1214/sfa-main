import { LightningElement, api, wire } from 'lwc';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { CurrentPageReference } from 'lightning/navigation';
import checkInVisit from '@salesforce/apex/VisitController.checkInVisit';
import checkOutVisit from '@salesforce/apex/VisitController.checkOutVisit';
import getVisitDetail from '@salesforce/apex/VisitController.getVisitDetail';
import getTodayAttendance from '@salesforce/apex/VisitController.getTodayAttendance';

export default class VisitDetail extends LightningElement {
    _visit;
    _visitId;
    recordId;

    @api
    get visit() {
        return this._visit;
    }
    set visit(value) {
        this._visit = value;
        this.recordId = value?.Id || this.recordId;
    }

    @api
    get visitId() {
        return this._visitId;
    }
    set visitId(value) {
        this._visitId = value;
        this.recordId = value || this.recordId;
    }
    @api dayStarted;
    @api dayEnded;
    @api isToday;
    pageVisitId;

    connectedCallback() {
        this.loadAttendance();
    }

    loadAttendance() {
        getTodayAttendance()
            .then(att => {
                this.dayStarted = !!att;
                this.dayEnded = !!att?.End_Time__c;
            })
            .catch(() => {
                this.dayStarted = false;
                this.dayEnded = false;
            });
    }

    @wire(CurrentPageReference)
    setCurrentPageReference(pageRef) {
        const id = pageRef?.state?.c__visitId;
        if (id) {
            this.pageVisitId = id;
            this.visitId = id;
        }
    }

    @wire(getVisitDetail, { visitId: '$recordId' })
    wiredVisit({ data, error }) {
        if (data) {
            this.visit = data;
            this.setIsTodayFromVisit(data);
            return;
        }

        if (error) {
            this.showToast(
                'Unable to load visit',
                error?.body?.message || 'Please try again.',
                'error'
            );
        }
    }

    setIsTodayFromVisit(visitRecord) {
        const visitDate = visitRecord?.ibfsa__Visit_Date__c;
        if (!visitDate) {
            this.isToday = this.isToday ?? true;
            return;
        }

        const today = new Date();
        const todayVal = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        const visitVal = new Date(visitDate).setHours(0, 0, 0, 0);
        this.isToday = todayVal === visitVal;
    }

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

    get plannedStart() {
        return this.formatTime(this.visit?.ibfsa__Planned_Start_Time__c);
    }

    get plannedEnd() {
        return this.formatTime(this.visit?.ibfsa__Planned_End_Time__c);
    }

    get sequenceLabel() {
        const seq = this.visit?.ibfsa__Sequence__c;
        return seq ? `#${seq}` : '—';
    }

    get showCheckIn() {
        return this.dayStarted &&
            !this.dayEnded &&
            this.isToday &&
            this.visit?.ibfsa__Visit_Status__c === 'Approved';
    }

    get showCheckOut() {
        return this.dayStarted &&
            !this.dayEnded &&
            this.isToday &&
            this.visit?.ibfsa__Visit_Status__c === 'In Progress';
    }

    get mapDisabled() {
        const outlet = this.visit?.ibfsa__Outlet__r;
        return !(outlet?.ibfsa__Outlet_Location__Latitude__s && outlet?.ibfsa__Outlet_Location__Longitude__s);
    }

    handleClose() {
        if (this.pageVisitId) {
            window.history.back();
            return;
        }
        this.dispatchEvent(new CustomEvent('close'));
    }

    navigateToMap(event) {
        event?.stopPropagation();
        const outlet = this.visit?.ibfsa__Outlet__r;
        const lat = outlet?.ibfsa__Outlet_Location__Latitude__s;
        const lon = outlet?.ibfsa__Outlet_Location__Longitude__s;

        if (!lat || !lon) {
            this.showToast('Location unavailable', 'Outlet location not available.', 'error');
            return;
        }

        const mapUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
        window.open(mapUrl, '_blank');
    }

    handleCheckIn(event) {
        event?.stopPropagation();
        this.performGeoAction(checkInVisit);
    }

    handleCheckOut(event) {
        event?.stopPropagation();
        this.performGeoAction(checkOutVisit);
    }

    performGeoAction(apexMethod) {
        if (!navigator?.geolocation) {
            this.showToast('Location unavailable', 'Geolocation is not supported.', 'error');
            return;
        }

        const visitId = this.recordId || this.visit?.Id;
        if (!visitId) {
            this.showToast('Visit not found', 'Missing visit id.', 'error');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            pos => {
                apexMethod({
                    visitId,
                    lat: pos.coords.latitude.toString(),
                    lon: pos.coords.longitude.toString()
                })
                .then(() => {
                    this.dispatchEvent(new CustomEvent('refresh'));
                    this.handleClose();
                    this.showToast('Success', 'Visit updated successfully.', 'success');
                })
                .catch(err => {
                    this.showToast('Action failed', err?.body?.message || 'Please try again.', 'error');
                });
            },
            () => this.showToast('Location required', 'Please enable location permission.', 'error'),
            { enableHighAccuracy: true }
        );
    }

    formatTime(value) {
        if (!value) return '—';
        try {
            const date = new Date(value);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return '—';
        }
    }

    showToast(title, message, variant) {
        this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
    }

    handleActivityClick(event) {
        const action = event?.currentTarget?.dataset?.action || 'Activity';
        this.showToast(action, 'This action is not configured yet.', 'info');
    }
}