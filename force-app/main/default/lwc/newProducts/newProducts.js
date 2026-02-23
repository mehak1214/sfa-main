import { LightningElement, track, wire } from 'lwc';
import getLatestNewProducts from '@salesforce/apex/NewProductsController.getLatestNewProducts';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class NewProducts extends NavigationMixin(LightningElement) {
    
    /* =========================================================
       TRACKED PROPERTIES
       ========================================================= */
    @track products = [];
    @track isLoading = false;
    @track errorMessage = '';

    /* =========================================================
       GETTERS FOR CONDITIONAL RENDERING
       ========================================================= */
    get hasProducts() {
        return this.products && this.products.length > 0;
    }

    get noProductsToDisplay() {
        return !this.isLoading && !this.hasProducts && !this.errorMessage;
    }

    /* =========================================================
       LIFECYCLE HOOKS
       ========================================================= */
    connectedCallback() {
        this.loadProducts();
    }

    /* =========================================================
       WIRE ADAPTERS - FETCH LATEST NEW PRODUCTS
       ========================================================= */
    @wire(getLatestNewProducts)
    wiredProducts({ data, error }) {
        if (data) {
            // Construct proper image URLs from ContentVersion IDs
            this.products = data.map(product => ({
                ...product,
                imageUrl: product.imageUrl 
                    ? `/sfc/servlet.shepherd/version/download/${product.imageUrl}`
                    : null
            }));
            this.isLoading = false;
        } else if (error) {
            this.handleError('Failed to load new products', error);
            this.isLoading = false;
        }
    }

    /* =========================================================
       LOAD PRODUCTS
       ========================================================= */
    loadProducts() {
        this.isLoading = true;
        this.errorMessage = '';
        // Wire adapter will handle the data loading
    }

    /* =========================================================
       EVENT HANDLERS
       ========================================================= */
    
    handleProductClick(event) {
        const productId = event.currentTarget.dataset.productId;
        if (productId) {
            this.navigateToProductRecord(productId);
        }
    }

    /* =========================================================
       NAVIGATION METHODS
       ========================================================= */
    
    navigateToProductRecord(productId) {
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: productId,
                objectApiName: 'Product2',
                actionName: 'view'
            }
        });
    }

    /* =========================================================
       UTILITY METHODS
       ========================================================= */
    
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