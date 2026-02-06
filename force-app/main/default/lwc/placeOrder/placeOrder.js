// Import required base classes and decorators from LWC
import { LightningElement, track, wire } from 'lwc';

// Import Apex methods (backend calls)
import getFranchiseAccounts from '@salesforce/apex/PlaceOrderController.getFranchiseAccounts';
import getProducts from '@salesforce/apex/PlaceOrderController.getProducts';
import placeOrder from '@salesforce/apex/PlaceOrderController.placeOrder';

// Import toast event to show success/error messages
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

// Import alert API for mobile notifications
import lightningAlert from 'lightning/alert';

// Component class definition
export default class OrderProductSelector extends LightningElement {

    // List of products (tracked so UI updates when data changes)
    @track products = [];

    // Franchise options for dropdown
    @track franchiseOptions = [];

    // Stores the selected franchise Id
    selectedFranchise;

    // 🔹 Automatically calls Apex method to get franchise accounts
    @wire(getFranchiseAccounts)
    wiredAccounts({ data }) {
        // If data is returned from Apex
        if (data) {
            // Convert account data into dropdown format
            this.franchiseOptions = data.map(acc => ({
                label: acc.Name, // Text shown in dropdown
                value: acc.Id    // Actual value used internally
            }));
        }
    }

    // 🔹 Automatically calls Apex method to get products
    @wire(getProducts)
    wiredProducts({ data }) {
        // If product data is returned
        if (data) {
            // Add a new field "quantity" to each product
            this.products = data.map(p => ({
                ...p,          // Copy all existing product fields
                quantity: 0    // Set default quantity to 0
            }));
        }
    }

    // 🔹 Called when user selects a franchise from dropdown
    handleFranchiseChange(event) {
        // Store selected franchise Id
        this.selectedFranchise = event.detail.value;
    }

    // 🔹 Called when + button is clicked
    increaseQty(event) {
        // Increase quantity by 1 for selected product
        this.updateQty(event.target.dataset.id, 1);
    }

    // 🔹 Called when - button is clicked
    decreaseQty(event) {
        // Decrease quantity by 1 for selected product
        this.updateQty(event.target.dataset.id, -1);
    }

    // 🔹 Common function to update product quantity
    updateQty(productId, change) {

        // Loop through all products and update only the matching one
        this.products = this.products.map(p => {

            // Check if this is the clicked product
            if (p.productId === productId) {

                // Calculate new quantity
                let qty = p.quantity + change;

                // Quantity should not go below 0
                return {
                    ...p, // Keep all other product fields same
                    quantity: qty < 0 ? 0 : qty
                };
            }

            // Return other products without changes
            return p;
        });
    }

    // 🔹 Called when user clicks Save Order button
    saveOrder() {
        // Validate franchise selection
        if (!this.selectedFranchise) {
            this.showToast('Error', 'Please select a franchise', 'error');
            return;
        }

        // Select only products with quantity greater than 0
        const selectedItems = this.products
            .filter(p => p.quantity > 0) // Filter selected products
            .map(p => {
                // Create a clean object with exact property names matching Apex wrapper
                const item = {
                    productId: p.productId || '',          // Avoid null
                    productName: p.productName || '',      // Avoid null
                    imageUrl: p.imageUrl || '',            // Avoid null
                    quantity: parseInt(p.quantity, 10) || 0 // Ensure integer
                };
                console.log('Mapping product:', JSON.stringify(item));
                return item;
            });

        // Validate that products are selected and have valid data
        if (selectedItems.length === 0) {
            this.showToast('Error', 'Please select at least one product', 'error');
            return;
        }

        // Validate each item has productId
        const invalidItems = selectedItems.filter(item => !item.productId);
        if (invalidItems.length > 0) {
            this.showToast('Error', 'Some products have invalid IDs', 'error');
            console.error('Invalid items:', invalidItems);
            return;
        }

        // Log data being sent to Apex (for debugging)
        console.log('=== SENDING TO APEX ===');
        console.log('Selected Items:', JSON.stringify(selectedItems));
        console.log('Selected Franchise ID:', this.selectedFranchise);
        console.log('Selected Items Count:', selectedItems.length);
        console.log('First Item:', selectedItems[0] ? JSON.stringify(selectedItems[0]) : 'None');

        // 🔹 Call Apex method to place the order
        placeOrder({
            franchiseId: this.selectedFranchise,  // Selected franchise
            selectedProducts: selectedItems       // Selected products
        })
        .then(async (result) => {
            // Show success message if order is created (awaiting for mobile alert)
            await this.showToast(
                'Success',
                'Order created successfully with ID: ' + result,
                'success'
            );
            // Reset the form after successful order
            this.products = this.products.map(p => ({
                ...p,
                quantity: 0
            }));
            this.selectedFranchise = undefined;
        })
        .catch(error => {
            // Show error message if something goes wrong
            const errorMsg = error.body?.message || error.message || 'An error occurred while creating the order';
            this.showToast(
                'Error',
                errorMsg,
                'error'
            );
            console.error('Error placing order:', error);
        });
    }

    // 🔹 Reusable function to show toast messages
    async showToast(title, message, variant) {
        // Always show toast event (works on web)
        this.dispatchEvent(
            new ShowToastEvent({
                title: title,
                message: message,
                variant: variant,
                duration: variant === 'success' ? 5000 : 10000 // Longer duration for errors
            })
        );

        // For mobile devices, also show alert to ensure notification is visible
        // Check if running on mobile using userAgent or platform detection
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                         (!window.document.documentElement.requestFullscreen);
        
        if (isMobile && variant === 'success') {
            // Use Lightning Alert API for mobile - shows dialog that's more visible on mobile
            try {
                await lightningAlert.open({
                    message: title + ': ' + message,
                    theme: variant === 'success' ? 'success' : 'error',
                    label: title.toUpperCase()
                });
            } catch (e) {
                // Silently fail if alert API not available
                console.log('Alert API not available, using toast only');
            }
        }
    }
}