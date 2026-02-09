// Import required base classes and decorators from LWC
import { LightningElement, track, api } from 'lwc';

// Import Apex methods (backend calls)
import placeOrder from '@salesforce/apex/PlaceOrderController.placeOrder';

// Import toast event to show success/error messages
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class PlaceOrderCart extends LightningElement {

    // Component: placeOrderCart
    // Purpose: Display cart items, allow quantity edits/removals, apply promo codes, and place the order.
    // - Receives `cartItems` from parent via @api setter and keeps an internal `_cartItems` backing store.
    // - Local `items` is the reactive state used for rendering.
    // - Updates are propagated back to parent via `cartupdate` events so the container stays in sync.

    // Receive cart items from parent
    @api
    set cartItems(value) {
        try {
            this._cartItems = Array.isArray(value) ? [...value] : [];
            this.syncItems();
        } catch (error) {
            /* silent error */
        }
    }
    get cartItems() {
        return this._cartItems || [];
    }
    
    _cartItems = [];
    
    // Receive franchise and distributor IDs from parent
    @api franchiseId;
    @api distributorId;
    
    // Track items locally (rendered state)
    @track items = [];
    
    // Promo code tracking
    @track promoCode = '';
    @track appliedPromoCode = '';
    @track hasAppliedPromo = false;
    
    connectedCallback() {
        // Lifecycle hook: component initialized. Heavy initialization avoided here.
    }
    
    renderedCallback() {
        /* rendered */
        
        // If we have cart items but items array is empty, sync them
        if (this._cartItems && this._cartItems.length > 0 && (!this.items || this.items.length === 0)) {
            this.syncItems();
        }
    }
    
    // Synchronize internal `_cartItems` backing store to the reactive `items` array used by the template.
    // Why: parent updates come in via @api `cartItems`; we convert to a safe local structure for rendering.
    syncItems() {
        try {
            if (this._cartItems && Array.isArray(this._cartItems) && this._cartItems.length > 0) {
                this.items = this._cartItems.map(item => ({
                    productId: item.productId,
                    productName: item.productName,
                    imageUrl: item.imageUrl,
                    quantity: item.quantity || 0
                }));
            } else {
                this.items = [];
            }
        } catch (error) {
            /* silent error */
            this.items = [];
        }
    }
    
    // 🔹 Called when + button is clicked in cart
    // Increase item quantity in cart and notify parent.
    increaseQty(event) {
        try {
            const productId = event.target.dataset.id;
            this.updateQty(productId, 1);
            this.dispatchCartUpdateEvent();
        } catch (error) {
            /* silent error */
        }
    }

    // 🔹 Called when - button is clicked in cart
    // Decrease item quantity in cart and notify parent.
    decreaseQty(event) {
        try {
            const productId = event.target.dataset.id;
            this.updateQty(productId, -1);
            this.dispatchCartUpdateEvent();
        } catch (error) {
            /* silent error */
        }
    }

    // 🔹 Common function to update product quantity in cart
    // Common function to update product quantity in cart
    // Also keeps the backing `_cartItems` in sync so parent-setter/state remains consistent.
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
            
            // Also update _cartItems to keep in sync
            if (this._cartItems && Array.isArray(this._cartItems)) {
                this._cartItems = this._cartItems.map(item => {
                    if (item && item.productId === productId) {
                        let qty = (item.quantity || 0) + change;
                        return {
                            ...item,
                            quantity: qty < 0 ? 0 : qty
                        };
                    }
                    return item;
                });
            }
        } catch (error) {
            /* silent error */
        }
    }

    // 🔹 Remove item from cart
    // Remove item from cart (both display and backing store) and notify parent.
    removeFromCart(event) {
        try {
            const productId = event.target.dataset.id;
            /* remove from cart called */
            
            if (this.items && Array.isArray(this.items)) {
                // Remove from display items
                this.items = this.items.filter(item => item && item.productId !== productId);
                /* items filtered */
                
                // Also remove from backing field (_cartItems)
                if (this._cartItems && Array.isArray(this._cartItems)) {
                    this._cartItems = this._cartItems.filter(item => item && item.productId !== productId);
                }
                
                // Notify parent that cart was updated
                this.dispatchCartUpdateEvent();
                
                this.showToast('Info', 'Product removed from cart', 'info');
            }
        } catch (error) {
            /* silent error */
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

    // 🔹 Check if promo code input is empty
    get isPromoCodeEmpty() {
        return !this.promoCode || this.promoCode.trim() === '';
    }

    // 🔹 Dispatch event to notify parent that cart was updated
    // Notify parent container that the cart has been updated.
    // Why: the container maintains the canonical cart state; it uses this event to update its copy.
    dispatchCartUpdateEvent() {
        try {
            this.dispatchEvent(new CustomEvent('cartupdate', {
                detail: {
                    cartItems: this.items,
                    totalItems: this.totalItems
                },
                bubbles: true,
                composed: true
            }));
        } catch (error) {
            /* silent error */
        }
    }

    // 🔹 Navigate back to product selection
    // Navigate back to the product selection view by informing the parent container.
    goToProductSelection() {
        try {
            this.dispatchEvent(new CustomEvent('backtoselection', { bubbles: true, composed: true }));
        } catch (error) {
            console.error('PlaceOrderCart: Error in goToProductSelection:', error);
        }
    }

    // 🔹 Save Order - Create order and line items
    // Call Apex to create an Order and line items; clear cart on success.
    // Note: Apex handles validation and inventory updates.
    saveOrder() {
        
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
            /* silent error */
        });
    }

    // 🔹 Handle promo code input change
    handlePromoCodeChange(event) {
        try {
            this.promoCode = event.target.value.toUpperCase();
            /* promo entered */
        } catch (error) {
            /* silent error */
        }
    }

    // 🔹 Apply promo code
    applyPromoCode() {
        try {
            if (!this.promoCode || this.promoCode.trim() === '') {
                this.showToast('Error', 'Please enter a promo code', 'error');
                return;
            }

            /* applying promo code */
            
            // Here you can add logic to validate promo code with backend
            // For now, we'll just accept any non-empty promo code
            this.appliedPromoCode = this.promoCode;
            this.hasAppliedPromo = true;
            
            this.showToast('Success', `Promo code '${this.promoCode}' has been applied!`, 'success');
        } catch (error) {
            this.showToast('Error', 'Failed to apply promo code', 'error');
        }
    }

    // 🔹 Remove applied promo code
    removePromoCode() {
        try {
            this.appliedPromoCode = '';
            this.promoCode = '';
            this.hasAppliedPromo = false;
            
            this.showToast('Info', 'Promo code has been removed', 'info');
            /* promo removed */
        } catch (error) {
            /* silent error */
        }
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
            /* silent error */
        }
    }
}