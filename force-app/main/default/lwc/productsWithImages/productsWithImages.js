import { LightningElement, track, wire } from 'lwc';
import getProductsWithImages from '@salesforce/apex/ProductsWithImagesController.getProductsWithImages';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class ProductsWithImages extends NavigationMixin(LightningElement) {
    
    @track products = [];
    @track isLoading = false;
    @track errorMessage = '';

    get hasProducts() {
        return this.products && this.products.length > 0;
    }

    get noProductsMessage() {
        return !this.isLoading && !this.hasProducts && !this.errorMessage;
    }

    connectedCallback() {
        this.loadProducts();
    }

    @wire(getProductsWithImages)
    wiredProducts({ data, error }) {
        if (data) {
            this.products = data;
            this.errorMessage = '';
            this.isLoading = false;
        } else if (error) {
            this.handleError('Failed to load products', error);
            this.isLoading = false;
        }
    }

    loadProducts() {
        this.isLoading = true;
        this.errorMessage = '';
    }

    handleProductClick(event) {
        const productId = event.currentTarget.dataset.productId;
        if (productId) {
            this.navigateToProductRecord(productId);
        }
    }

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