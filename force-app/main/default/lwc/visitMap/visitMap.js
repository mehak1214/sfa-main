import { LightningElement, api, track } from 'lwc';

export default class VisitMap extends LightningElement {

    @api visits = [];

    @track mapMarkers = [];
    @track mapCenter;

    connectedCallback() {
        this.loadCurrentLocation();
    }

    renderedCallback() {
        this.prepareVisitMarkers();
    }

    loadCurrentLocation() {
        if (!navigator.geolocation) return;

        navigator.geolocation.getCurrentPosition(
            pos => {
                const lat = pos.coords.latitude;
                const lon = pos.coords.longitude;

                this.mapCenter = {
                    Latitude: lat,
                    Longitude: lon
                };

                const userMarker = {
                    location: { Latitude: lat, Longitude: lon },
                    title: 'You are here',
                    icon: 'utility:user'
                };

                this.mapMarkers = [userMarker, ...this.mapMarkers];
            },
            () => {},
            { enableHighAccuracy: true }
        );
    }

    prepareVisitMarkers() {
        if (!this.visits?.length) return;

        const visitMarkers = this.visits
            .filter(v => v.ibfsa__Outlet__r?.BillingLatitude)
            .map(v => ({
                location: {
                    Latitude: v.ibfsa__Outlet__r.BillingLatitude,
                    Longitude: v.ibfsa__Outlet__r.BillingLongitude
                },
                title: v.ibfsa__Outlet__r.Name,
                description: `Status: ${v.ibfsa__Visit_Status__c}`
            }));

        this.mapMarkers = [...this.mapMarkers, ...visitMarkers];
    }
}