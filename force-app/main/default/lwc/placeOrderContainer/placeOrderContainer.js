// Import required base classes and decorators from LWC
import { LightningElement, track } from 'lwc';

// Component class definition
// Component: placeOrderContainer
// Purpose: Parent orchestrator that holds the cart state and switches between
// the product selection (`placeOrder`) and the shopping cart (`placeOrderCart`).
// - Listens for `addtocart` and `cartupdate` events (bound in template) and
//   keeps the canonical `cartItems` array here.
// - Keeps franchise/distributor selections associated with the cart.
export default class PlaceOrderContainer extends LightningElement {

    // Track which view is active: 'selection' or 'cart'
    @track activeView = 'selection';

    // Canonical cart data stored in the container
    @track cartItems = [];
    @track franchiseId = null;
    @track distributorId = null;

    connectedCallback() {
        // component initialized - event handlers are bound in template markup
    }

    // 🔹 Handle Add to Cart event from placeOrder component
    handleAddToCart(event) {
        try {
            const { franchiseId, distributorId, items } = event.detail;
            
            // Import items into cart
            this.franchiseId = franchiseId;
            this.distributorId = distributorId;
            
            // Clear or merge items with existing cart
            items.forEach(newItem => {
                const existingItem = this.cartItems.find(item => item.productId === newItem.productId);
                if (existingItem) {
                    existingItem.quantity += newItem.quantity;
                } else {
                    this.cartItems.push({...newItem});
                }
            });
            
            // Force reactivity by creating new array reference
            this.cartItems = [...this.cartItems];
            // Switch to cart view
            this.activeView = 'cart';
        } catch (error) {
            /* silent error */
        }
    }

    // 🔹 Handle Cart Update event from placeOrderCart component (when items are removed/changed)
    handleCartUpdate(event) {
        try {
            const { cartItems } = event.detail;
            this.cartItems = [...cartItems];
        } catch (error) {
            /* silent error */
        }
    }

    // 🔹 Handle Back to Selection event from cart component
    handleBackToSelection() {
        this.activeView = 'selection';
    }

    // 🔹 Handle Order Placed event from cart component
    handleOrderPlaced(event) {
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