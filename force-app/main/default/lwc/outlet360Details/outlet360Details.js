import { api, LightningElement, wire } from 'lwc';
import { NavigationMixin, CurrentPageReference } from 'lightning/navigation';
import getOutlet360Summary from '@salesforce/apex/Outlet360Controller.getOutlet360Summary';

export default class Outlet360Details extends NavigationMixin(LightningElement) {
    @api recordId;
    @api objectApiName;

    relatedLists = [];
    recentOrders = [];
    allOrders = [];
    orderProducts = [];
    recentInvoices = [];
    isLoading = false;
    loadError;
    scannedRelationships = 0;
    totalRelationships = 0;
    isTruncated = false;
    pastRevenue = 0;
    ordersCount = 0;
    totalOrdersCount = 0;
    invoicesCount = 0;
    ordersObjectApiName;
    invoicesObjectApiName;
    outletName;
    outletCode;
    outletStatus;
    outletPhone;
    outletAddress;
    isOrderModalOpen = false;
    _lastLoadKey;

    @wire(CurrentPageReference)
    setCurrentPageReference(pageRef) {
        // Keep component state aligned when route params are updated in-place.
        const state = pageRef?.state || {};
        const stateRecordId = state.c__recordId;
        const stateObjectApiName = state.c__objectApiName;

        let didChange = false;
        if (stateRecordId && stateRecordId !== this.recordId) {
            this.recordId = stateRecordId;
            didChange = true;
        }
        if (stateObjectApiName && stateObjectApiName !== this.objectApiName) {
            this.objectApiName = stateObjectApiName;
            didChange = true;
        }

        if (didChange) {
            this.loadData();
        }
    }

    connectedCallback() {
        // Handles contexts where pageRef wiring is delayed in mobile containers.
        this.initializeFromUrl();
        this.loadData();
    }

    initializeFromUrl() {
        try {
            const params = new URLSearchParams(window.location.search);
            const urlRecordId = params.get('c__recordId');
            const urlObjectApiName = params.get('c__objectApiName');

            if (urlRecordId && !this.recordId) {
                this.recordId = urlRecordId;
            }
            if (urlObjectApiName && !this.objectApiName) {
                this.objectApiName = urlObjectApiName;
            }
        } catch (error) {
            // no-op
        }
    }

    get hasRecordContext() {
        return !!this.recordId;
    }

    get hasRelatedLists() {
        return this.relatedLists.length > 0;
    }

    get resolvedObjectApiName() {
        return this.objectApiName || 'Account';
    }

    get relatedSectionTitle() {
        return `Related Data (${this.relatedLists.length})`;
    }

    get displayOutletName() {
        return this.outletName || 'Outlet';
    }

    get hasOutletSubInfo() {
        return !!(this.outletCode || this.outletStatus || this.outletPhone || this.outletAddress);
    }

    get hasRecentOrders() {
        return this.recentOrders.length > 0;
    }

    get hasAllOrders() {
        return this.allOrders.length > 0;
    }

    get hasOrderProducts() {
        return this.orderProducts.length > 0;
    }

    get hasRecentInvoices() {
        return this.recentInvoices.length > 0;
    }

    get pastRevenueLabel() {
        return this.formatCurrency(this.pastRevenue);
    }

    get ordersSectionLabel() {
        return `Orders (${this.totalOrdersCount || this.ordersCount})`;
    }

    get invoicesSectionLabel() {
        return `Invoices (${this.invoicesCount})`;
    }

    get statusLine() {
        if (!this.hasRecordContext) {
            return 'Missing record context.';
        }
        return `Scanned ${this.scannedRelationships} of ${this.totalRelationships} relationships`;
    }

    get showViewAllOrders() {
        return (this.totalOrdersCount || 0) > 5;
    }

    loadData() {
        if (!this.hasRecordContext) {
            return;
        }

        const currentKey = `${this.recordId}:${this.objectApiName}`;
        if (this._lastLoadKey === currentKey && this.isLoading) {
            return;
        }

        this._lastLoadKey = currentKey;
        this.isLoading = true;
        this.loadError = null;

        getOutlet360Summary({
            recordId: this.recordId,
            objectApiName: this.resolvedObjectApiName
        })
            .then((result) => {
                // Normalize server response for template rendering.
                this.relatedLists = (result?.relatedLists || []).map((item) => ({
                    ...item,
                    rowKey: `${item.childObjectApiName}:${item.referenceFieldApiName}`
                }));
                this.outletName = result?.outletName;
                this.outletCode = result?.outletCode;
                this.outletStatus = result?.outletStatus;
                this.outletPhone = result?.outletPhone;
                this.outletAddress = result?.outletAddress;
                this.pastRevenue = result?.pastRevenue || 0;
                this.ordersCount = result?.ordersCount || 0;
                this.totalOrdersCount = result?.totalOrdersCount || this.ordersCount;
                this.invoicesCount = result?.invoicesCount || 0;
                this.ordersObjectApiName = result?.ordersObjectApiName;
                this.invoicesObjectApiName = result?.invoicesObjectApiName;
                this.recentOrders = (result?.recentOrders || []).map((item) => ({
                    ...item,
                    rowKey: `order-${item.recordId}`,
                    amountLabel: this.formatCurrency(item.amount),
                    dateLabel: this.formatDate(item.recordDate)
                }));
                this.recentInvoices = (result?.recentInvoices || []).map((item) => ({
                    ...item,
                    rowKey: `invoice-${item.recordId}`,
                    amountLabel: this.formatCurrency(item.amount),
                    dateLabel: this.formatDate(item.recordDate)
                }));
                this.allOrders = (result?.allOrders || []).map((item) => ({
                    ...item,
                    rowKey: `all-order-${item.recordId}`,
                    amountLabel: this.formatCurrency(item.amount),
                    dateLabel: this.formatDate(item.recordDate)
                }));
                this.orderProducts = (result?.orderProducts || []).map((item, index) => ({
                    ...item,
                    rowKey: `order-product-${item.orderItemId || index}`,
                    unitPriceLabel: this.formatCurrency(item.unitPrice),
                    totalPriceLabel: this.formatCurrency(item.totalPrice)
                }));
                this.scannedRelationships = result?.scannedRelationships || 0;
                this.totalRelationships = result?.totalRelationships || 0;
                this.isTruncated = !!result?.isTruncated;
            })
            .catch((error) => {
                this.relatedLists = [];
                this.outletName = null;
                this.outletCode = null;
                this.outletStatus = null;
                this.outletPhone = null;
                this.outletAddress = null;
                this.recentOrders = [];
                this.allOrders = [];
                this.orderProducts = [];
                this.recentInvoices = [];
                this.pastRevenue = 0;
                this.ordersCount = 0;
                this.totalOrdersCount = 0;
                this.invoicesCount = 0;
                this.scannedRelationships = 0;
                this.totalRelationships = 0;
                this.isTruncated = false;
                this.loadError = error?.body?.message || 'Unable to load outlet 360 details.';
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleBack() {
        try {
            if (window.history.length > 1) {
                window.history.back();
                return;
            }
        } catch (error) {
            // Continue with fallback navigation.
        }

        this[NavigationMixin.Navigate]({
            type: 'standard__navItemPage',
            attributes: {
                apiName: 'Sales_Rep'
            }
        });
    }

    handleRefresh() {
        this.loadData();
    }

    handleOpenOrderModal() {
        this.isOrderModalOpen = true;
    }

    handleCloseOrderModal() {
        this.isOrderModalOpen = false;
    }

    formatCurrency(value) {
        const numeric = Number(value || 0);
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 2
        }).format(numeric);
    }

    formatDate(value) {
        if (!value) return '--';
        try {
            return new Date(value).toLocaleDateString('en-IN', {
                day: '2-digit',
                month: 'short',
                year: 'numeric'
            });
        } catch (error) {
            return '--';
        }
    }
}