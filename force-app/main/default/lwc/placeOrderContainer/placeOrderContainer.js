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
        console.log('Container: Component initialized, ready to handle events');
        // Event handlers are bound in the HTML template via onaddtocart={handleAddToCart}, 
        // onbacktoselection={handleBackToSelection}, and onorderplaced={handleOrderPlaced}
        // so we don't need to add explicit event listeners here
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

    // 🔹 Handle Cart Update event from placeOrderCart component (when items are removed/changed)
    handleCartUpdate(event) {
        try {
            console.log('Container: handleCartUpdate fired!');
            const { cartItems } = event.detail;
            
            console.log('Container: Received cartItems from child:', cartItems.length);
            
            // Update cart items from child component
            this.cartItems = [...cartItems];
            
            console.log('Container: Updated cartItems:', this.cartItems.length);
        } catch (error) {
            console.error('Container: Error in handleCartUpdate:', error);
        }
    }

    // 🔹 Handle Back to Selection event from cart component
    handleBackToSelection() {
        console.log('Container: handleBackToSelection fired!');
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

    // Getters for CSS display binding
    get showSelectionStyle() {
        return this.activeView === 'selection' ? 'display: block;' : 'display: none;';
    }

    get showCartStyle() {
        return this.activeView === 'cart' ? 'display: block;' : 'display: none;';
    }
}