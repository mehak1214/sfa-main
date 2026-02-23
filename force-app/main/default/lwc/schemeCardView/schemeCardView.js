import { LightningElement, track, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getSchemesDashboard from '@salesforce/apex/SchemesController.getSchemesDashboard';
import getAllSchemes from '@salesforce/apex/SchemesController.getAllSchemes';

export default class SchemeCardView extends NavigationMixin(LightningElement) {
    @track schemes = [];
    @track allSchemes = [];
    @track isLoading = true;
    @track isModalOpen = false;
    @track isDetailLoading = false;
    @track moreCount = 0;
    @track totalCount = 0;
    maxDisplay = 3;

    get hasSchemes() {
        return this.schemes && this.schemes.length > 0;
    }

    get noSchemesMessage() {
        return !this.isLoading && !this.hasSchemes;
    }

    get hasMoreSchemes() {
        return this.moreCount > 0;
    }

    get hasAllSchemes() {
        return this.allSchemes && this.allSchemes.length > 0;
    }

    @wire(getSchemesDashboard)
    wiredSchemes({ error, data }) {
        if (data) {
            const topSchemes = data.topSchemes || [];
            this.schemes = topSchemes.slice(0, this.maxDisplay);
            this.totalCount = data.totalCount || 0;
            this.moreCount = data.moreCount || 0;
            this.isLoading = false;
            console.log('Schemes loaded:', this.schemes, 'More count:', this.moreCount);
        } else if (error) {
            this.isLoading = false;
            console.error('Error loading schemes:', error);
        }
    }

    handleViewAllSchemes(event) {
        event.preventDefault();
        this.isDetailLoading = true;
        this.loadAllSchemes();
        this.isModalOpen = true;
    }

    handleCloseModal() {
        this.isModalOpen = false;
        this.allSchemes = [];
    }

    loadAllSchemes() {
        getAllSchemes()
            .then(result => {
                this.allSchemes = result;
                this.isDetailLoading = false;
                console.log('All schemes loaded:', this.allSchemes);
            })
            .catch(error => {
                console.error('Error loading all schemes:', error);
                this.isDetailLoading = false;
            });
    }

    handleSchemeClick(event) {
        event.preventDefault();
        const schemeId = event.currentTarget.dataset.schemeId;
        if (schemeId) {
            this.navigateToSchemeRecord(schemeId);
        }
    }

    navigateToSchemeRecord(schemeId) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: schemeId,
                actionName: 'view'
            }
        });
    }}