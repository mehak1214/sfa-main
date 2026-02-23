import { LightningElement, track } from 'lwc';
import userId from '@salesforce/user/Id';
import currencyCode from '@salesforce/i18n/currency';
import getOrdersByActivatedByUser from '@salesforce/apex/OrdersByUserController.getOrdersByActivatedByUser';
import getOrdersByActivatedByUserWithStatus from '@salesforce/apex/OrdersByUserController.getOrdersByActivatedByUserWithStatus';
import getOrderDetail from '@salesforce/apex/OrdersByUserController.getOrderDetail';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class OrdersByUser extends LightningElement {
    
    /* =========================================================
       TRACKED PROPERTIES
       ========================================================= */
    @track orders = [];
    @track isLoading = false;
    @track errorMessage = '';
    @track selectedStatus = 'All';
    @track selectedOrderTab = 'ALL';
    @track isDetailModalOpen = false;
    @track isDetailLoading = false;
    @track selectedOrder = null;
    
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
        return this.visibleOrders && this.visibleOrders.length > 0;
    }

    get noOrdersToDisplay() {
        return !this.isLoading && !this.hasOrders && !this.errorMessage;
    }

    get isAllTab() {
        return this.selectedOrderTab === 'ALL';
    }

    get isSampleTab() {
        return this.selectedOrderTab === 'SAMPLE';
    }

    get isRegularTab() {
        return this.selectedOrderTab === 'REGULAR';
    }

    get allTabClass() {
        return `orders-tab${this.isAllTab ? ' active' : ''}`;
    }

    get sampleTabClass() {
        return `orders-tab${this.isSampleTab ? ' active' : ''}`;
    }

    get regularTabClass() {
        return `orders-tab${this.isRegularTab ? ' active' : ''}`;
    }

    get visibleOrders() {
        if (!this.orders || this.orders.length === 0) {
            return [];
        }

        if (this.selectedOrderTab === 'ALL') {
            return this.orders;
        }

        return this.orders.filter(order => this.matchesOrderTab(order.orderType));
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
                    orderType: order.orderType || 'N/A',
                    productCount: order.productCount || 0,
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

    handleTabChange(event) {
        this.selectedOrderTab = event.currentTarget.dataset.tab;
    }

    handleCardClick(event) {
        const orderId = event.currentTarget.dataset.orderId;
        this.openOrderDetail(orderId);
    }

    handleViewDetailsClick(event) {
        event.stopPropagation();
        const orderId = event.currentTarget.dataset.orderId;
        this.openOrderDetail(orderId);
    }

    openOrderDetail(orderId) {
        this.isDetailModalOpen = true;
        this.isDetailLoading = true;
        this.selectedOrder = null;

        getOrderDetail({ orderId: orderId })
            .then((result) => {
                this.selectedOrder = {
                    ...result,
                    orderType: result.orderType || 'N/A',
                    productCount: result.productCount || 0,
                    formattedAmount: this.formatCurrency(result.totalAmount),
                    formattedOrderStartDate: this.formatDate(result.orderStartDate),
                    billingAddress: this.formatAddress(
                        result.billingStreet,
                        result.billingCity,
                        result.billingState,
                        result.billingPostalCode,
                        result.billingCountry
                    ),
                    shippingAddress: this.formatAddress(
                        result.shippingStreet,
                        result.shippingCity,
                        result.shippingState,
                        result.shippingPostalCode,
                        result.shippingCountry
                    )
                };
                this.isDetailLoading = false;
            })
            .catch((error) => {
                this.isDetailLoading = false;
                this.handleError('Failed to load order details', error);
            });
    }

    handleCloseDetail() {
        this.isDetailModalOpen = false;
        this.selectedOrder = null;
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

    formatAddress(street, city, state, postalCode, country) {
        const line1 = street || '';
        const line2 = [city, state, postalCode].filter(Boolean).join(', ');
        const parts = [line1, line2, country].filter(Boolean);
        return parts.length ? parts.join(' | ') : 'Not available';
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

    matchesOrderTab(orderTypeValue) {
        const type = (orderTypeValue || '').toLowerCase();
        if (this.selectedOrderTab === 'SAMPLE') {
            return type.includes('sample');
        }
        if (this.selectedOrderTab === 'REGULAR') {
            return type.includes('regular');
        }
        return true;
    }
}