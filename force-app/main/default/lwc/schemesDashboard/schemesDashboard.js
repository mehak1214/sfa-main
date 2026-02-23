import { LightningElement, track, wire } from 'lwc';
import getSchemesDashboard from '@salesforce/apex/SchemesController.getSchemesDashboard';
import getAllSchemes from '@salesforce/apex/SchemesController.getAllSchemes';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class SchemesDashboard extends NavigationMixin(LightningElement) {
    
    /* =========================================================
       TRACKED PROPERTIES
       ========================================================= */
    @track topSchemes = [];
    @track allSchemes = [];
    @track schemeStylesMap = {};
    @track allSchemeStylesMap = {};
    @track isLoading = true;
    @track isDetailLoading = false;
    @track errorMessage = '';
    @track isModalOpen = false;
    @track totalCount = 0;
    @track moreCount = 0;

    /* =========================================================
       GETTERS FOR CONDITIONAL RENDERING
       ========================================================= */
    get hasSchemes() {
        return this.topSchemes && this.topSchemes.length > 0;
    }

    get noSchemesToDisplay() {
        return !this.isLoading && !this.hasSchemes && !this.errorMessage;
    }

    get hasMoreSchemes() {
        return this.moreCount > 0;
    }

    get moreSchemesLabel() {
        //return `View + ${this.moreCount} more scheme${this.moreCount !== 1 ? 's' : ''}`;
        return `View All Schemes`;
    }

    get debugInfo() {
        return {
            isLoading: this.isLoading,
            hasSchemes: this.hasSchemes,
            topSchemesLength: this.topSchemes ? this.topSchemes.length : 0,
            errorMessage: this.errorMessage,
            totalCount: this.totalCount,
            moreCount: this.moreCount
        };
    }

    /* =========================================================
       LIFECYCLE HOOKS
       ========================================================= */
    connectedCallback() {
        console.log('=== SchemesDashboard component connected ===');
        console.log('isLoading:', this.isLoading);
        setTimeout(() => {
            if (this.isLoading) {
                console.warn('Wire adapter still loading after 5 seconds');
            }
        }, 5000);
    }

    /* =========================================================
       WIRE ADAPTERS - FETCH SCHEMES DASHBOARD
       ========================================================= */
    @wire(getSchemesDashboard)
    wiredSchemesDashboard({ data, error }) {
        console.log('Wire adapter called - data:', data, 'error:', error);
        if (data) {
            console.log('Data received:', data);
            this.topSchemes = data.topSchemes || [];
            this.totalCount = data.totalCount || 0;
            this.moreCount = data.moreCount || 0;
            this.computeTileStyles(this.topSchemes);
            this.isLoading = false;
            console.log('Schemes loaded successfully. Schemes count:', this.topSchemes.length);
        } else if (error) {
            this.isLoading = false;
            console.error('Full error object:', error);
            console.error('Error message:', error.message);
            console.error('Error body:', error.body);
            if (error.body && error.body.message) {
                this.errorMessage = 'Error: ' + error.body.message;
            } else if (error.message) {
                this.errorMessage = 'Error: ' + error.message;
            } else {
                this.errorMessage = 'Failed to load schemes: ' + JSON.stringify(error);
            }
            this.showToast('Error', this.errorMessage, 'error');
        }
    }

    /* =========================================================
       EVENT HANDLERS
       ========================================================= */
    
    handleSchemeClick(event) {
        event.preventDefault();
        const schemeId = event.currentTarget.dataset.schemeId;
        if (schemeId) {
            this.navigateToSchemeRecord(schemeId);
        }
    }

    handleSchemeDetailClick(event) {
        event.preventDefault();
        const schemeId = event.currentTarget.dataset.schemeId;
        if (schemeId) {
            this.navigateToSchemeRecord(schemeId);
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

    handleRefresh() {
        console.log('Refresh button clicked');
        this.isLoading = true;
        this.errorMessage = '';
        // Force a refresh by re-calling the wire adapter
        this.refreshWire();
    }

    refreshWire() {
        // This will trigger the wire adapter to re-evaluate
        console.log('Refreshing wire adapter');
        // The wire adapter will automatically re-fire
    }

    /* =========================================================
       LOAD ALL SCHEMES FOR MODAL
       ========================================================= */
    loadAllSchemes() {
        getAllSchemes()
            .then(result => {
                this.allSchemes = result;
                this.computeDetailStyles(result);
                this.isDetailLoading = false;
            })
            .catch(error => {
                this.handleError('Failed to load all schemes', error);
                this.isDetailLoading = false;
            });
    }

    /* =========================================================
       NAVIGATION METHODS
       ========================================================= */
    
    navigateToSchemeRecord(schemeId) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: schemeId,
                objectApiName: 'ibfsa__Scheme__c',
                actionName: 'view'
            }
        });
    }

    /* =========================================================
       COMPUTED STYLE METHODS
       ========================================================= */
    
    computeTileStyles(schemes) {
        // Styles are already computed in Apex wrapper, no need to do anything here
        console.log('Tile styles already set in Apex', schemes);
    }

    computeDetailStyles(schemes) {
        // Styles are already computed in Apex wrapper, no need to do anything here
        console.log('Detail styles already set in Apex', schemes);
    }

    /* =========================================================
       UTILITY METHODS
       ========================================================= */
    
    getTileStyle(scheme) {
        // Return inline styles for tile background color
        if (scheme && scheme.color) {
            return `background-color: ${scheme.color};`;
        }
        return 'background-color: #4CAF50;';
    }

    getSchemeStyle(schemeId) {
        return this.schemeStylesMap[schemeId] || 'background-color: #4CAF50;';
    }

    getDetailStyle(schemeId) {
        return this.allSchemeStylesMap[schemeId] || 'background-color: #4CAF50;';
    }

    handleError(message, error) {
        console.error(message, error);
        this.errorMessage = message;
        this.showToast('Error', message, 'error');
    }

    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant
            })
        );
    }
}