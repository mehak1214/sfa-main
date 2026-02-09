// Import required base classes and decorators from LWC
import { LightningElement, track, wire } from 'lwc';

// Import Apex methods (backend calls)
import getFranchiseAccounts from '@salesforce/apex/PlaceOrderController.getFranchiseAccounts';
import getDealerDistributorAccounts from '@salesforce/apex/PlaceOrderController.getDealerDistributorAccounts';
import getProducts from '@salesforce/apex/PlaceOrderController.getProducts';
import getProductsByDistributor from '@salesforce/apex/PlaceOrderController.getProductsByDistributor';
import placeOrder from '@salesforce/apex/PlaceOrderController.placeOrder';

// Import toast event to show success/error messages
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

// Component class definition
export default class PlaceOrder extends LightningElement {

    // List of products (tracked so UI updates when data changes)
    @track products = [];

    // Franchise options for dropdown
    @track franchiseOptions = [];

    // Distributor options for dropdown
    @track distributorOptions = [];

    // Stores the selected franchise Id
    @track selectedFranchise;

    // Stores the selected distributor Id
    @track selectedDistributor;

    // 🔹 Automatically calls Apex method to get franchise accounts
    @wire(getFranchiseAccounts)
    wiredAccounts({ data }) {
        if (data) {
            this.franchiseOptions = data.map(acc => ({
                label: acc.Name,
                value: acc.Id
            }));
        }
    }

    // 🔹 Automatically calls Apex method to get dealer/distributor accounts
    @wire(getDealerDistributorAccounts)
    wiredDistributors({ data }) {
        if (data) {
            this.distributorOptions = data.map(acc => ({
                label: acc.Name,
                value: acc.Id
            }));
        }
    }

    // 🔹 Automatically calls Apex method to get products based on distributor selection
    @wire(getProductsByDistributor, { distributorId: '$selectedDistributor' })
    wiredProducts({ data }) {
        console.log('PlaceOrder: wiredProducts called, data:', data ? 'received' : 'none');
        if (data) {
            console.log('PlaceOrder: Raw Apex data:', JSON.stringify(data.slice(0, 2))); // First 2 items for debugging
            this.products = data.map(p => {
                console.log('PlaceOrder: Mapping product - ID:', p.productId, 'Name:', p.productName, 'Apex Qty:', p.quantity, 'Type:', typeof p.quantity);
                return {
                    ...p,
                    quantity: 0
                };
            });
            console.log('PlaceOrder: Products loaded and mapped:', this.products.length, 'items');
        } else {
            // Reset products when no distributor selected
            console.log('PlaceOrder: No products data received');
            this.products = [];
        }
    }

    // 🔹 Called when user selects a franchise from dropdown
    handleFranchiseChange(event) {
        this.selectedFranchise = event.detail.value;
    }

    // 🔹 Called when user selects a distributor from dropdown
    handleDistributorChange(event) {
        this.selectedDistributor = event.detail.value;
    }

    // 🔹 Called when + button is clicked
    increaseQty(event) {
        this.updateQty(event.target.dataset.id, 1);
    }

    // 🔹 Called when - button is clicked
    decreaseQty(event) {
        this.updateQty(event.target.dataset.id, -1);
    }

    // 🔹 Common function to update product quantity
    updateQty(productId, change) {
        this.products = this.products.map(p => {
            if (p.productId === productId) {
                let qty = p.quantity + change;
                return {
                    ...p,
                    quantity: qty < 0 ? 0 : qty
                };
            }
            return p;
        });
    }

    // 🔹 Called when user clicks Add to Cart button
    addToCart() {
        console.log('PlaceOrder: addToCart called');
        
        if (!this.selectedFranchise) {
            console.log('PlaceOrder: No franchise selected');
            this.showToast('Error', 'Please select a franchise', 'error');
            return;
        }

        if (!this.selectedDistributor) {
            console.log('PlaceOrder: No distributor selected');
            this.showToast('Error', 'Please select a dealer/distributor', 'error');
            return;
        }

        console.log('PlaceOrder: All products before filter:', JSON.stringify(this.products.map(p => ({ productId: p.productId, productName: p.productName, quantity: p.quantity }))));

        const selectedItems = this.products
            .filter(p => p.quantity > 0)
            .map(p => {
                console.log('PlaceOrder: Processing product - ID:', p.productId, 'Name:', p.productName, 'Qty (original):', p.quantity, 'Type:', typeof p.quantity);
                const qty = parseInt(p.quantity, 10);
                console.log('PlaceOrder: After parseInt - Qty:', qty, 'Type:', typeof qty);
                return {
                    productId: p.productId || '',
                    productName: p.productName || '',
                    imageUrl: p.imageUrl || '',
                    quantity: qty || 0
                };
            });

        console.log('PlaceOrder: Selected items:', JSON.stringify(selectedItems));
        console.log('PlaceOrder: Selected items count:', selectedItems.length);

        if (selectedItems.length === 0) {
            console.log('PlaceOrder: No items selected');
            this.showToast('Error', 'Please select at least one product', 'error');
            return;
        }

        const invalidItems = selectedItems.filter(item => !item.productId);
        if (invalidItems.length > 0) {
            console.log('PlaceOrder: Invalid items found');
            this.showToast('Error', 'Some products have invalid IDs', 'error');
            console.error('Invalid items:', invalidItems);
            return;
        }

        console.log('PlaceOrder: Final event detail:', JSON.stringify({ franchiseId: this.selectedFranchise, distributorId: this.selectedDistributor, items: selectedItems }));

        // Dispatch event to parent component with cart items
        this.dispatchEvent(new CustomEvent('addtocart', {
            detail: {
                franchiseId: this.selectedFranchise,
                distributorId: this.selectedDistributor,
                items: selectedItems
            },
            bubbles: true,
            composed: true
        }));

        console.log('PlaceOrder: Event dispatched successfully');

        this.showToast('Success', 'Products added to cart!', 'success');

        // Reset quantities after adding to cart
        this.products = this.products.map(p => ({
            ...p,
            quantity: 0
        }));
    }

    // 🔹 Reusable function to show toast messages (works on desktop & mobile)
    showToast(title, message, variant) {
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant,
                //mode: 'sticky', // keeps toast visible until dismissed (good for mobile)
                duration: variant === 'success' ? 5000 : 10000
            })
        );
    }
}