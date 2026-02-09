// Import required base classes and decorators from LWC
import { LightningElement, track } from 'lwc';

// Component class definition
export default class PlaceOrderContainer extends LightningElement {

    // Track which view is active: 'selection' or 'cart'
    @track activeView = 'selection';

    // Cart data
    @track cartItems = [];
    @track franchiseId = null;
    @track distributorId = null;

    connectedCallback() {
        console.log('Container: connectedCallback fired!');
        console.log('Container: Adding event listener for addtocart');
        // Add an event listener to catch the addtocart event from placeOrder
        this.addEventListener('addtocart', (event) => {
            console.log('Container: Event listener caught addtocart event!');
            console.log('Container: Event detail:', event.detail);
            this.handleAddToCart(event);
        });
        console.log('Container: Event listener attached');
    }

    // 🔹 Handle Add to Cart event from placeOrder component
    handleAddToCart(event) {
        try {
            console.log('Container: handleAddToCart fired!');
            console.log('Container: event:', event);
            console.log('Container: event.detail:', event.detail);
        
            const { franchiseId, distributorId, items } = event.detail;
            
            console.log('Container: Received franchiseId:', franchiseId, 'distributorId:', distributorId, 'items:', items.length);
            console.log('Container: Items to add:', JSON.stringify(items));
            
            // Import items into cart
            this.franchiseId = franchiseId;
            this.distributorId = distributorId;
            
            // Clear or merge items with existing cart
            items.forEach(newItem => {
                const existingItem = this.cartItems.find(item => item.productId === newItem.productId);
                if (existingItem) {
                    console.log('Container: Updating existing item:', newItem.productId, 'qty:', existingItem.quantity, '+', newItem.quantity);
                    existingItem.quantity += newItem.quantity;
                } else {
                    console.log('Container: Adding new item:', newItem.productId, 'qty:', newItem.quantity);
                    this.cartItems.push({...newItem});
                }
            });
            
            // Force reactivity by creating new array reference
            this.cartItems = [...this.cartItems];
            
            console.log('Container: Updated cart items total:', this.cartItems.length);
            console.log('Container: cartItems array:', JSON.stringify(this.cartItems));
            console.log('Container: franchiseId:', this.franchiseId, 'distributorId:', this.distributorId);
            
            // Switch to cart view
            this.activeView = 'cart';
            console.log('Container: Switched to cart view');
        } catch (error) {
            console.error('Container: Error in handleAddToCart:', error);
        }
    }

    // 🔹 Handle Back to Selection event from cart component
    handleBackToSelection() {
        this.activeView = 'selection';
    }

    // 🔹 Handle Order Placed event from cart component
    handleOrderPlaced(event) {
        console.log('Container: handleOrderPlaced called');
        // Order was successfully placed, reset cart and switch back to selection view
        this.cartItems = [];
        this.franchiseId = null;
        this.distributorId = null;
        this.activeView = 'selection';
    }

    // Getters for conditional rendering
    get showSelection() {
        return this.activeView === 'selection';
    }

    get showCart() {
        return this.activeView === 'cart';
    }

    get showSelectionStyle() {
        return this.activeView === 'selection' ? 'display: block;' : 'display: none;';
    }

    get showCartStyle() {
        return this.activeView === 'cart' ? 'display: block;' : 'display: none;';
    }
}