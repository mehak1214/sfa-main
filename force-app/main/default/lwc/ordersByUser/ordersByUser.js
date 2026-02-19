import { LightningElement, track } from 'lwc';
import userId from '@salesforce/user/Id';
import currencyCode from '@salesforce/i18n/currency';
import getOrdersByActivatedByUser from '@salesforce/apex/OrdersByUserController.getOrdersByActivatedByUser';
import getOrdersByActivatedByUserWithStatus from '@salesforce/apex/OrdersByUserController.getOrdersByActivatedByUserWithStatus';
import { NavigationMixin } from 'lightning/navigation';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class OrdersByUser extends NavigationMixin(LightningElement) {
    
    /* =========================================================
       TRACKED PROPERTIES
       ========================================================= */
    @track orders = [];
    @track isLoading = false;
    @track errorMessage = '';
    @track selectedStatus = 'All';
    
    currentUserId = userId;

    /* =========================================================
       STATUS OPTIONS FOR FILTER DROPDOWN
       ========================================================= */
    statusOptions = [
        { label: 'All', value: 'All' },
        { label: 'Draft', value: 'Draft' },
        { label: 'Activated', value: 'Activated' },
        { label: 'Completed', value: 'Completed' },
        { label: 'Cancelled', value: 'Cancelled' }
    ];

    /* =========================================================
       GETTERS FOR CONDITIONAL RENDERING
       ========================================================= */
    get hasOrders() {
        return this.orders && this.orders.length > 0;
    }

    get noOrdersToDisplay() {
        return !this.isLoading && !this.hasOrders && !this.errorMessage;
    }

    /* =========================================================
       LIFECYCLE HOOKS
       ========================================================= */
    connectedCallback() {
        this.loadOrders();
    }

    /* =========================================================
       LOAD ORDERS
       ========================================================= */
    loadOrders() {
        if (!this.currentUserId) {
            return;
        }

        this.isLoading = true;
        this.errorMessage = '';

        const method = this.selectedStatus === 'All' 
            ? getOrdersByActivatedByUser 
            : getOrdersByActivatedByUserWithStatus;
        
        const params = this.selectedStatus === 'All' 
            ? { userId: this.currentUserId }
            : { userId: this.currentUserId, status: this.selectedStatus };

        method(params)
            .then(result => {
                this.orders = result.map(order => ({
                    ...order,
                    formattedAmount: this.formatCurrency(order.totalAmount),
                    formattedOrderDate: this.formatDate(order.orderDate)
                }));
                this.isLoading = false;
            })
            .catch(error => {
                this.handleError('Failed to load orders', error);
                this.isLoading = false;
            });
    }

    /* =========================================================
       EVENT HANDLERS
       ========================================================= */
    
    handleStatusChange(event) {
        this.selectedStatus = event.detail.value;
        this.loadOrders();
    }

    handleCardClick(event) {
        const orderId = event.currentTarget.dataset.orderId;
        this.navigateToOrderDetailPage(orderId);
    }

    handleViewDetailsClick(event) {
        event.stopPropagation();
        const orderId = event.currentTarget.dataset.orderId;
        this.navigateToOrderDetailPage(orderId);
    }

    /* =========================================================
       NAVIGATION METHODS
       ========================================================= */
    
    navigateToOrderDetailPage(orderId) {
        this[NavigationMixin.Navigate]({
            type: 'standard__component',
            attributes: {
                componentName: 'c__orderDetailPage'
            },
            state: {
                c__orderId: orderId
            }
        });
    }

    /* =========================================================
       UTILITY METHODS
       ========================================================= */
    
    formatCurrency(amount) {
        if (!amount) {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currencyCode
            }).format(0);
        }
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currencyCode
        }).format(amount);
    }

    formatDate(dateValue) {
        if (!dateValue) {
            return '-';
        }

        return new Intl.DateTimeFormat('en-US', {
            year: 'numeric',
            month: 'short',
            day: '2-digit'
        }).format(new Date(dateValue));
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