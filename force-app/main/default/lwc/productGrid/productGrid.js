import { LightningElement, wire } from 'lwc';
import { NavigationMixin } from 'lightning/navigation';
import getAllProducts from '@salesforce/apex/ProductGridController.getAllProducts';

export default class ProductGrid extends NavigationMixin(LightningElement) {
    @wire(getAllProducts)
    wiredProducts({ error, data }) {
        if (data) {
            this.allProducts = data;
            this.displayedProducts = data.slice(0, 3);
            this.remainingCount = Math.max(0, data.length - 3);
            console.log('Products loaded:', this.allProducts);
        } else if (error) {
            console.error('Error loading products:', error);
            this.errorMessage = 'Error loading products: ' + (error.body?.message || error.message);
        }
    }

    allProducts = [];
    displayedProducts = [];
    remainingCount = 0;
    errorMessage = '';
    showModal = false;

    get hasMoreProducts() {
        return this.remainingCount > 0;
    }

    get moreProductsLabel() {
        return `+${this.remainingCount} more ${this.remainingCount === 1 ? 'scheme' : 'schemes'}`;
    }

    handleShowMore() {
        this.showModal = true;
    }

    handleCloseModal() {
        this.showModal = false;
    }

    handleProductClick(event) {
        const productId = event.currentTarget.dataset.productId;
        this[NavigationMixin.Navigate]({
            type: 'standard__recordPage',
            attributes: {
                recordId: productId,
                actionName: 'view'
            }
        });
    }
}