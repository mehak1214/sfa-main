// Import required base classes and decorators from LWC
import { LightningElement, track, api } from 'lwc';

// Import Apex methods (backend calls)
import placeOrder from '@salesforce/apex/PlaceOrderController.placeOrder';

// Import toast event to show success/error messages
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class PlaceOrderCart extends LightningElement {
    
    // Receive cart items from parent
    @api
    set cartItems(value) {
        try {
            console.log('PlaceOrderCart: cartItems setter called with:', value ? value.length : 0, 'items');
            this._cartItems = Array.isArray(value) ? [...value] : [];
            console.log('PlaceOrderCart: cartItems set to:', this._cartItems.length, 'items');
            this.syncItems();
        } catch (error) {
            console.error('PlaceOrderCart: Error in cartItems setter:', error);
        }
    }
    get cartItems() {
        return this._cartItems || [];
    }
    
    _cartItems = [];
    
    // Receive franchise and distributor IDs from parent
    @api franchiseId;
    @api distributorId;
    
    // Track items locally
    @track items = [];
    
    connectedCallback() {
        console.log('PlaceOrderCart: connectedCallback - cartItems:', this.cartItems ? this.cartItems.length : 0);
    }
    
    renderedCallback() {
        console.log('PlaceOrderCart: renderedCallback - checking if items need syncing');
        console.log('PlaceOrderCart: renderedCallback - _cartItems:', this._cartItems ? this._cartItems.length : 0);
        console.log('PlaceOrderCart: renderedCallback - items:', this.items ? this.items.length : 0);
        
        // If we have cart items but items array is empty, sync them
        if (this._cartItems && this._cartItems.length > 0 && (!this.items || this.items.length === 0)) {
            console.log('PlaceOrderCart: renderedCallback - triggering sync');
            this.syncItems();
        }
    }
    
    syncItems() {
        try {
            console.log('PlaceOrderCart: syncItems called, _cartItems length:', this._cartItems ? this._cartItems.length : 0);
            if (this._cartItems && Array.isArray(this._cartItems) && this._cartItems.length > 0) {
                this.items = this._cartItems.map(item => ({
                    productId: item.productId,
                    productName: item.productName,
                    imageUrl: item.imageUrl,
                    quantity: item.quantity || 0
                }));
                console.log('PlaceOrderCart: Successfully synced', this.items.length, 'items');
            } else {
                console.log('PlaceOrderCart: No items to sync, setting items to empty array');
                this.items = [];
            }
        } catch (error) {
            console.error('PlaceOrderCart: Error in syncItems:', error);
            this.items = [];
        }
    }
    
    // 🔹 Called when + button is clicked in cart
    increaseQty(event) {
        try {
            const productId = event.target.dataset.id;
            this.updateQty(productId, 1);
        } catch (error) {
            console.error('PlaceOrderCart: Error in increaseQty:', error);
        }
    }

    // 🔹 Called when - button is clicked in cart
    decreaseQty(event) {
        try {
            const productId = event.target.dataset.id;
            this.updateQty(productId, -1);
        } catch (error) {
            console.error('PlaceOrderCart: Error in decreaseQty:', error);
        }
    }

    // 🔹 Common function to update product quantity in cart
    updateQty(productId, change) {
        try {
            if (!this.items || !Array.isArray(this.items)) {
                this.items = [];
                return;
            }
            
            this.items = this.items.map(item => {
                if (item && item.productId === productId) {
                    let qty = (item.quantity || 0) + change;
                    return {
                        ...item,
                        quantity: qty < 0 ? 0 : qty
                    };
                }
                return item;
            });
        } catch (error) {
            console.error('PlaceOrderCart: Error in updateQty:', error);
        }
    }

    // 🔹 Remove item from cart
    removeFromCart(event) {
        try {
            const productId = event.target.dataset.id;
            if (this.items && Array.isArray(this.items)) {
                this.items = this.items.filter(item => item && item.productId !== productId);
            }
        } catch (error) {
            console.error('PlaceOrderCart: Error in removeFromCart:', error);
        }
    }

    // 🔹 Calculate total items in cart
    get totalItems() {
        return this.items && Array.isArray(this.items) ? this.items.reduce((total, item) => total + (item.quantity || 0), 0) : 0;
    }

    // 🔹 Calculate total cost (placeholder - would need actual pricing)
    get totalPrice() {
        return this.items && Array.isArray(this.items) ? this.items.reduce((total, item) => total + ((item.quantity || 0) * (item.price || 0)), 0) : 0;
    }

    // 🔹 Navigate back to product selection
    goToProductSelection() {
        try {
            this.dispatchEvent(new CustomEvent('backtoselection', { bubbles: true, composed: true }));
        } catch (error) {
            console.error('PlaceOrderCart: Error in goToProductSelection:', error);
        }
    }

    // 🔹 Save Order - Create order and line items
    saveOrder() {
        console.log('PlaceOrderCart: saveOrder called, franchiseId:', this.franchiseId, 'distributorId:', this.distributorId);
        
        if (!this.franchiseId) {
            this.showToast('Error', 'Franchise information is missing', 'error');
            return;
        }

        if (!this.distributorId) {
            this.showToast('Error', 'Distributor information is missing', 'error');
            return;
        }

        const selectedItems = this.items
            .filter(item => item.quantity && item.quantity > 0)
            .map(item => ({
                productId: item.productId || '',
                productName: item.productName || '',
                imageUrl: item.imageUrl || '',
                quantity: parseInt(item.quantity, 10) || 0
            }));

        if (selectedItems.length === 0) {
            this.showToast('Error', 'Please add at least one product to cart', 'error');
            return;
        }

        console.log('PlaceOrderCart: Creating order with', selectedItems.length, 'items');

        placeOrder({
            franchiseId: this.franchiseId,
            distributorId: this.distributorId,
            selectedProducts: selectedItems
        })
        .then((result) => {
            this.showToast(
                'Success',
                'Order created successfully with ID: ' + result,
                'success'
            );
            // Clear cart after successful order
            this.items = [];
            this._cartItems = [];
            
            // Dispatch event to parent to reset or navigate
            this.dispatchEvent(new CustomEvent('orderplaced', {
                detail: { orderId: result },
                bubbles: true,
                composed: true
            }));
        })
        .catch(error => {
            const errorMsg = error.body?.message || error.message || 'An error occurred while creating the order';
            this.showToast('Error', errorMsg, 'error');
            console.error('Error placing order:', error);
        });
    }

    // 🔹 Reusable function to show toast messages (works on desktop & mobile)
    showToast(title, message, variant) {
        try {
            this.dispatchEvent(
                new ShowToastEvent({
                    title: title,
                    message: message,
                    variant: variant,
                    duration: variant === 'success' ? 5000 : 10000
                })
            );
        } catch (error) {
            console.error('PlaceOrderCart: Error in showToast:', error);
        }
    }
}