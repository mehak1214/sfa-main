public with sharing class PlaceOrderController {

    /* =========================================================
       PRODUCT WRAPPER
       ========================================================= */
    public class ProductOrderWrapper {
        @AuraEnabled public Id productId;
        @AuraEnabled public String productName;
        @AuraEnabled public String imageUrl;
        @AuraEnabled public Integer quantity;
        @AuraEnabled public Decimal unitPrice;
        @AuraEnabled public Decimal discountedTotal;
        @AuraEnabled public String selectedSchemeId;
        @AuraEnabled public List<SchemeOption> schemes;

        // Helper to initialize lists
        private void initWrapper() {
            if (this.schemes == null) this.schemes = new List<SchemeOption>();
            if (this.unitPrice == null) this.unitPrice = 0;
            if (this.discountedTotal == null) this.discountedTotal = 0;
            if (this.selectedSchemeId == null) this.selectedSchemeId = null;
        }

        // Default constructor
        public ProductOrderWrapper() {
        }

        // Constructor with parameters for proper deserialization
        public ProductOrderWrapper(Id pId, String pName, String pImageUrl, Integer pQty) {
            this.productId = pId;
            this.productName = pName;
            this.imageUrl = pImageUrl;
            this.quantity = pQty;
            initWrapper();
        }
    }

    // Simple wrapper to send scheme options to LWC
    public class SchemeOption {
        @AuraEnabled public Id value;
        @AuraEnabled public String label;
        @AuraEnabled public Decimal discount;

        public SchemeOption(Id val, String lab, Decimal disc) {
            this.value = val;
            this.label = lab;
            this.discount = disc == null ? 0 : disc;
        }
    }

    /* =========================================================
       LOAD PRODUCTS BY DISTRIBUTOR (with schemes)
       ========================================================= */
    @AuraEnabled(cacheable=true)
    public static List<ProductOrderWrapper> getProductsByDistributor(Id distributorId) {
        System.debug(' getProductsByDistributor() called with distributorId: ' + distributorId);

        if (distributorId == null) {
            System.debug(' ERROR: Distributor ID is null');
            return new List<ProductOrderWrapper>();
        }

        // Get all inventory items related to the distributor
        List<ibfsa__Inventory_Item__c> inventoryItems = [
            SELECT Id, ibfsa__Product__c
            FROM ibfsa__Inventory_Item__c
            WHERE ibfsa__Inventory__c IN (
                SELECT Id FROM ibfsa__Inventory__c WHERE ibfsa__Dealer__c = :distributorId
            )
            AND ibfsa__Product__c != null
        ];

        Set<Id> productIds = new Set<Id>();
        for (ibfsa__Inventory_Item__c item : inventoryItems) productIds.add(item.ibfsa__Product__c);

        if (productIds.isEmpty()) return new List<ProductOrderWrapper>();

        List<Product2> products = [
            SELECT Id, Name
            FROM Product2
            WHERE Id IN :productIds
            AND IsActive = true
            AND ibfsa__Is_Vashi_Product__c = true
        ];

        Map<Id, ProductOrderWrapper> productsById = new Map<Id, ProductOrderWrapper>();
        for (Product2 p : products) {
            ProductOrderWrapper w = new ProductOrderWrapper();
            w.productId = p.Id;
            w.productName = p.Name;
            w.quantity = 0;
            w.initWrapper();
            productsById.put(p.Id, w);
        }

        if (productsById.isEmpty()) return new List<ProductOrderWrapper>();

        // Attach images
        List<ContentDocumentLink> imageLinks = [
            SELECT LinkedEntityId, ContentDocument.LatestPublishedVersionId
            FROM ContentDocumentLink
            WHERE LinkedEntityId IN :productsById.keySet()
        ];
        for (ContentDocumentLink link : imageLinks) {
            if (productsById.containsKey(link.LinkedEntityId)) {
                productsById.get(link.LinkedEntityId).imageUrl = '/sfc/servlet.shepherd/version/download/' + link.ContentDocument.LatestPublishedVersionId;
            }
        }

        // Fetch unit prices from standard pricebook
        try {
            List<PricebookEntry> pbes = [
                SELECT Product2Id, UnitPrice, Pricebook2.IsStandard
                FROM PricebookEntry
                WHERE Product2Id IN :productsById.keySet()
                AND IsActive = true
                AND Pricebook2.IsStandard = true
            ];
            for (PricebookEntry pbe : pbes) {
                if (productsById.containsKey(pbe.Product2Id)) productsById.get(pbe.Product2Id).unitPrice = pbe.UnitPrice == null ? 0 : pbe.UnitPrice;
            }
        } catch (Exception ex) {
            System.debug(' WARNING: price fetch failed: ' + ex.getMessage());
        }

        // Fetch schemes via junction object
        try {
            List<ibfsa__Scheme_Product__c> sps = [
                SELECT ibfsa__Product__c, ibfsa__Scheme__c, ibfsa__Scheme__r.Name, ibfsa__Scheme__r.ibfsa__Discount__c, ibfsa__Scheme__r.ibfsa__Active__c
                FROM ibfsa__Scheme_Product__c
                WHERE ibfsa__Product__c IN :productsById.keySet()
                AND ibfsa__Scheme__r.ibfsa__Active__c = true
            ];
            for (ibfsa__Scheme_Product__c sp : sps) {
                if (sp.ibfsa__Product__c != null && productsById.containsKey(sp.ibfsa__Product__c)) {
                    Decimal disc = sp.ibfsa__Scheme__r != null ? sp.ibfsa__Scheme__r.ibfsa__Discount__c : 0;
                    productsById.get(sp.ibfsa__Product__c).schemes.add(new SchemeOption(sp.ibfsa__Scheme__c, sp.ibfsa__Scheme__r != null ? sp.ibfsa__Scheme__r.Name : 'Scheme', disc));
                }
            }
        } catch (Exception ex) {
            System.debug(' WARNING: scheme fetch failed: ' + ex.getMessage());
        }

        return productsById.values();
    }

    /* =========================================================
       LOAD PRODUCTS
       ========================================================= */
    @AuraEnabled(cacheable=true)
    public static List<ProductOrderWrapper> getProducts() {

        System.debug(' getProducts() called');

        List<Product2> vashiProducts = [
            SELECT Id, Name
            FROM Product2
            WHERE IsActive = true
            AND ibfsa__Is_Vashi_Product__c = true
        ];

        System.debug(' Products fetched: ' + vashiProducts.size());

        Map<Id, ProductOrderWrapper> productsById = new Map<Id, ProductOrderWrapper>();
		System.debug(' Map <Id,ProductOrderWrapper> : id'+productsById.keyset() +'ProductOrderWrapper - '+productsById.values());
        
        for (Product2 product : vashiProducts) {
            System.debug(' Wrapping product: ' + product.Id + ' | ' + product.Name);

            ProductOrderWrapper wrapper = new ProductOrderWrapper();
            wrapper.productId   = product.Id;
            wrapper.productName = product.Name;
            wrapper.quantity    = 0;

            productsById.put(product.Id, wrapper);
        }

        if (productsById.isEmpty()) {
            System.debug(' No Vashi products found');
            return new List<ProductOrderWrapper>();
        }

        List<ContentDocumentLink> imageLinks = [
            SELECT LinkedEntityId, ContentDocument.LatestPublishedVersionId
            FROM ContentDocumentLink
            WHERE LinkedEntityId IN :productsById.keySet()
        ];

        System.debug(' Image links found: ' + imageLinks.size());

        for (ContentDocumentLink link : imageLinks) {
            System.debug(
                ' Linking image to product ' +
                link.LinkedEntityId +
                ' | VersionId: ' +
                link.ContentDocument.LatestPublishedVersionId
            );

            productsById.get(link.LinkedEntityId).imageUrl =
                '/sfc/servlet.shepherd/version/download/' +
                link.ContentDocument.LatestPublishedVersionId;
        }

        System.debug(' getProducts() completed' +productsById.values());
        return productsById.values();
    }

    /* =========================================================
       LOAD FRANCHISE ACCOUNTS
       ========================================================= */
    @AuraEnabled(cacheable=true)
    public static List<Account> getFranchiseAccounts() {
        System.debug(' getFranchiseAccounts() called');

        List<Account> accts = [
            SELECT Id, Name
            FROM Account
            WHERE RecordType.DeveloperName = 'Franchise'
            WITH SECURITY_ENFORCED
            ORDER BY Name
        ];

        System.debug(' Franchise accounts found: ' + accts.size());
        return accts;
    }

    /* =========================================================
       LOAD DISTRIBUTOR ACCOUNTS
       ========================================================= */
    @AuraEnabled(cacheable=true)
    public static List<Account> getDistributorAccounts() {
        System.debug(' getDistributorAccounts() called');

        List<Account> accts = [
            SELECT Id, Name
            FROM Account
            WHERE RecordType.DeveloperName = 'Dealer_Distributor'
            WITH SECURITY_ENFORCED
            ORDER BY Name
        ];

        System.debug(' Distributor accounts found: ' + accts.size());
        return accts;
    }

    /* =========================================================
       PLACE ORDER + LINE ITEMS
       ========================================================= */
    @AuraEnabled
    public static Id placeOrder(
        Id franchiseId,
        Id distributorId,
        List<Map<String, Object>> selectedProducts
    ) {

        System.debug(' placeOrder() called');
        System.debug(' Franchise Id: ' + franchiseId);
        System.debug(' Selected Products (Raw Map): ' + JSON.serialize(selectedProducts));
        System.debug(' Selected Products count: ' + (selectedProducts != null ? selectedProducts.size() : 0));

        if (franchiseId == null) {
            System.debug(' ERROR: Franchise ID is NULL');
            throw new AuraHandledException(
                'Please select a franchise before placing the order.'
            );
        }

        if (selectedProducts == null || selectedProducts.isEmpty()) {
            System.debug(' ERROR: No products received from UI');
            throw new AuraHandledException(
                'Please select at least one product before placing the order.'
            );
        }

        // Convert the Map list to ProductOrderWrapper objects and capture unitPrice + selectedSchemeId
        List<ProductOrderWrapper> wrappedProducts = new List<ProductOrderWrapper>();
        Set<Id> productIds = new Set<Id>();
        Set<Id> schemeIds = new Set<Id>();

        for (Map<String, Object> productMap : selectedProducts) {
            System.debug(' Converting product map: ' + JSON.serialize(productMap));

            ProductOrderWrapper wrapper = new ProductOrderWrapper();
            wrapper.productId   = (Id)productMap.get('productId');
            wrapper.productName = (String)productMap.get('productName');
            wrapper.imageUrl    = (String)productMap.get('imageUrl');

            // quantity
            Object qtyObj = productMap.get('quantity');
            if (qtyObj != null) {
                if (qtyObj instanceof Integer) {
                    wrapper.quantity = (Integer)qtyObj;
                } else if (qtyObj instanceof String) {
                    wrapper.quantity = Integer.valueOf((String)qtyObj);
                } else if (qtyObj instanceof Double) {
                    wrapper.quantity = ((Double)qtyObj).intValue();
                }
            }

            // unitPrice (may come as Double, Decimal or String)
            wrapper.unitPrice = 0;
            Object upObj = productMap.get('unitPrice');
            if (upObj != null) {
                try {
                    wrapper.unitPrice = Decimal.valueOf(String.valueOf(upObj));
                } catch (Exception ex) {
                    wrapper.unitPrice = 0;
                }
            }

            // selected scheme id
            // selected scheme id (store as string and collect Ids for discount lookup)
            wrapper.selectedSchemeId = null;
            Object schemeObj = productMap.get('selectedSchemeId');
            if (schemeObj != null) {
                try {
                    String sIdStr = String.valueOf(schemeObj);
                    wrapper.selectedSchemeId = sIdStr;
                    // try to add to schemeIds as Id when possible
                    try {
                        Id sId = (Id)schemeObj;
                        schemeIds.add(sId);
                    } catch (Exception innerEx) {
                        // ignore
                    }
                } catch (Exception ex) {
                    // ignore
                }
            }

            // discounted total (client-computed value)
            wrapper.discountedTotal = 0;
            Object dtObj = productMap.get('discountedTotal');
            if (dtObj != null) {
                try {
                    wrapper.discountedTotal = Decimal.valueOf(String.valueOf(dtObj));
                } catch (Exception ex) {
                    wrapper.discountedTotal = 0;
                }
            }

            if (wrapper.productId != null) productIds.add(wrapper.productId);
            System.debug(' Wrapped product - ID: ' + wrapper.productId + 
                         ' | Name: ' + wrapper.productName + 
                         ' | Qty: ' + wrapper.quantity + 
                         ' | UnitPrice: ' + wrapper.unitPrice);

            wrappedProducts.add(wrapper);
        }

        // Load scheme discounts for any selected schemes
        Map<Id, Decimal> schemeDiscounts = new Map<Id, Decimal>();
        if (!schemeIds.isEmpty()) {
            for (ibfsa__Scheme__c s : [SELECT Id, ibfsa__Discount__c FROM ibfsa__Scheme__c WHERE Id IN :schemeIds AND ibfsa__Active__c = true]) {
                schemeDiscounts.put(s.Id, s.ibfsa__Discount__c == null ? 0 : s.ibfsa__Discount__c);
            }
        }

        System.debug(' Total wrapped products: ' + wrappedProducts.size());

        /* ---------- CREATE ORDER ---------- */
        ibfsa__Order__c order = new ibfsa__Order__c(
            ibfsa__Franchises__c = franchiseId,
            ibfsa__Order_Date__c = Date.today()
        );

        // set distributor if provided
        if (distributorId != null) {
            order.ibfsa__Distributer__c = distributorId;
        }

        insert order;

        System.debug(' Order created with Id: ' + order.Id);

        /* ---------- CREATE LINE ITEMS ---------- */
        List<ibfsa__Order_Line_Item__c> lineItems = new List<ibfsa__Order_Line_Item__c>();

        System.debug(' Creating line items for ' + wrappedProducts.size() + ' products');

        // We'll compute totals while building line items
        Decimal orderTotal = 0;
        for (ProductOrderWrapper product : wrappedProducts) {
            // Validate product object
            if (product == null) {
                System.debug(' WARNING: Skipping null product object');
                continue;
            }

            // Validate productId
            if (product.productId == null) {
                System.debug(' WARNING: Product ID is null, skipping');
                continue;
            }

            // Validate quantity
            if (product.quantity == null || product.quantity <= 0) {
                System.debug(' WARNING: Product quantity is null or <= 0, skipping. Qty: ' + product.quantity);
                continue;
            }

            System.debug(
                ' Creating line item - Product ID: ' + product.productId +
                ' | Quantity: ' + product.quantity
            );

            // compute unit price and discounts
            Decimal unitPrice = product.unitPrice == null ? 0 : product.unitPrice;
            Integer qty = product.quantity == null ? 0 : product.quantity;
            Decimal subtotal = unitPrice * qty;

            // find selected scheme id from wrapper (if provided) and compute discount pct
            Id selectedSchemeId = null;
            if (product.selectedSchemeId != null) {
                try {
                    selectedSchemeId = Id.valueOf(product.selectedSchemeId);
                } catch (Exception ex) {
                    selectedSchemeId = null;
                }
            }

            Decimal discountPct = 0;
            if (selectedSchemeId != null && schemeDiscounts.containsKey(selectedSchemeId)) {
                discountPct = schemeDiscounts.get(selectedSchemeId);
            }

            Decimal discountAmount = subtotal * (discountPct / 100);
            Decimal lineTotalAfterDiscount = subtotal - discountAmount;

            // prefer client-provided discounted total if available
            Decimal finalDiscountedTotal = (product.discountedTotal != null && product.discountedTotal > 0) ? product.discountedTotal : lineTotalAfterDiscount;

            ibfsa__Order_Line_Item__c oli = new ibfsa__Order_Line_Item__c(
                ibfsa__Order__c    = order.Id,
                ibfsa__Product__c  = product.productId,
                ibfsa__Quantity__c = qty,
                ibfsa__Unit_Price__c    = unitPrice
            );

            // Set per-line totals and scheme discount details
            try {
                oli.ibfsa__Total_Price__c = subtotal;
            } catch (Exception e) {
                // fallback using dynamic put if typed field unavailable
                oli.put('Total_Price__c', subtotal);
            }

            

            try {
                oli.ibfsa__Discount_Total_Price__c = lineTotalAfterDiscount;
            } catch (Exception e) {
                oli.put('Discount_Total_Price__c', lineTotalAfterDiscount);
            }

            // store which scheme was applied (if any)
            if (selectedSchemeId != null) {
                try {
                    oli.ibfsa__Scheme__c = selectedSchemeId;
                } catch (Exception e) {
                    oli.put('Scheme__c', selectedSchemeId);
                }
                
            }

            orderTotal += lineTotalAfterDiscount;

            lineItems.add(oli);
            System.debug(' Line item created for product: ' + product.productId + ' with qty: ' + product.quantity);
        }

        System.debug(' Total line items prepared for insertion: ' + lineItems.size());

        if (!lineItems.isEmpty()) {
            insert lineItems;
            System.debug(' SUCCESS: ' + lineItems.size() + ' line items inserted successfully');
        } else {
            System.debug(' ERROR: No line items were inserted. No valid products found.');
            throw new AuraHandledException(
                'No valid line items could be created. Please verify your product selections.'
            );
        }

        // Update order total and persist
        try {
            order.ibfsa__Total_Price__c = orderTotal;
            // also try to set non-namespaced field if present
            try {
                order.put('Total_Price__c', orderTotal);
            } catch (Exception innerEx) {
                // ignore - best-effort
            }
            update order;
        } catch (Exception ex) {
            System.debug(' WARNING: Failed to update order total: ' + ex.getMessage());
        }

        // Decrement inventory for the distributor if provided
        if (distributorId != null && !productIds.isEmpty()) {
            try {
                List<ibfsa__Inventory_Item__c> invItems = [
                    SELECT Id, ibfsa__Product__c, ibfsa__AvailableStock__c
                    FROM ibfsa__Inventory_Item__c
                    WHERE ibfsa__Inventory__c IN (
                        SELECT Id FROM ibfsa__Inventory__c WHERE ibfsa__Dealer__c = :distributorId
                    )
                    AND ibfsa__Product__c IN :productIds
                    FOR UPDATE
                ];

                Map<Id, ibfsa__Inventory_Item__c> invByProduct = new Map<Id, ibfsa__Inventory_Item__c>();
                for (ibfsa__Inventory_Item__c ii : invItems) {
                    invByProduct.put(ii.ibfsa__Product__c, ii);
                }

                for (ProductOrderWrapper wp : wrappedProducts) {
                    if (wp.productId != null && invByProduct.containsKey(wp.productId)) {
                        ibfsa__Inventory_Item__c ii = invByProduct.get(wp.productId);
                        Integer orderedQty = wp.quantity == null ? 0 : wp.quantity;
                        Decimal avail = ii.ibfsa__AvailableStock__c == null ? 0 : ii.ibfsa__AvailableStock__c;
                        Decimal newAvail = avail - orderedQty;
                        if (newAvail < 0) newAvail = 0;
                        ii.ibfsa__AvailableStock__c = newAvail;
                    }
                }

                if (!invItems.isEmpty()) update invItems;
            } catch (Exception ex) {
                System.debug(' WARNING: Inventory decrement failed: ' + ex.getMessage());
            }
        }

        System.debug(' placeOrder() completed successfully. Order ID: ' + order.Id);
        return order.Id;
    }
}