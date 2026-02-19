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

        private void initWrapper() {
            if (this.unitPrice == null) this.unitPrice = 0;
            if (this.discountedTotal == null) this.discountedTotal = 0;
        }

        public ProductOrderWrapper() {
        }

        public ProductOrderWrapper(Id pId, String pName, String pImageUrl, Integer pQty) {
            this.productId = pId;
            this.productName = pName;
            this.imageUrl = pImageUrl;
            this.quantity = pQty;
            initWrapper();
        }
    }

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
       LOAD PRODUCTS BY DISTRIBUTOR
       ========================================================= */
    @AuraEnabled(cacheable=true)
    public static List<ProductOrderWrapper> getProductsByDistributor(Id distributorId) {

        if (distributorId == null) {
            return new List<ProductOrderWrapper>();
        }

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
            AND ibfsa__Is_Vashi_Product__c = true Order By CreatedDate ASC Limit 5
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
            // Best effort: products should still load even if standard price is unavailable.
        }

        return new List<ProductOrderWrapper>(productsById.values());
    }

    /* =========================================================
       LOAD PRODUCTS
       ========================================================= */
    @AuraEnabled(cacheable=true)
    public static List<ProductOrderWrapper> getProducts() {


        List<Product2> vashiProducts = [
            SELECT Id, Name
            FROM Product2
            WHERE IsActive = true
            AND ibfsa__Is_Vashi_Product__c = true
        ];


        Map<Id, ProductOrderWrapper> productsById = new Map<Id, ProductOrderWrapper>();
        
        for (Product2 product : vashiProducts) {

            ProductOrderWrapper wrapper = new ProductOrderWrapper();
            wrapper.productId   = product.Id;
            wrapper.productName = product.Name;
            wrapper.quantity    = 0;

            productsById.put(product.Id, wrapper);
        }

        if (productsById.isEmpty()) {
            return new List<ProductOrderWrapper>();
        }

        List<ContentDocumentLink> imageLinks = [
            SELECT LinkedEntityId, ContentDocument.LatestPublishedVersionId
            FROM ContentDocumentLink
            WHERE LinkedEntityId IN :productsById.keySet()
        ];


        for (ContentDocumentLink link : imageLinks) {
            if (productsById.containsKey(link.LinkedEntityId)) {
                productsById.get(link.LinkedEntityId).imageUrl =
                    '/sfc/servlet.shepherd/version/download/' +
                    link.ContentDocument.LatestPublishedVersionId;
            }
        }

        return new List<ProductOrderWrapper>(productsById.values());
    }

    /* =========================================================
       LOAD FRANCHISE ACCOUNTS
       ========================================================= */
    @AuraEnabled(cacheable=true)
    public static List<Account> getFranchiseAccounts() {

        List<Account> accts = [
            SELECT Id, Name
            FROM Account
            WHERE RecordType.DeveloperName = 'Franchise'
            WITH SECURITY_ENFORCED
            ORDER BY Name
        ];

        return accts;
    }

    /* =========================================================
       LOAD DISTRIBUTOR ACCOUNTS
       ========================================================= */
    @AuraEnabled(cacheable=true)
    public static List<Account> getDistributorAccounts() {

        List<Account> accts = [
            SELECT Id, Name
            FROM Account
            WHERE RecordType.DeveloperName = 'Dealer_Distributor'
            WITH SECURITY_ENFORCED
            ORDER BY Name
        ];

        return accts;
    }

    /* =========================================================
       LOAD SCHEMES BY THRESHOLD QUANTITY
       ========================================================= */
    @AuraEnabled(cacheable=true)
    public static List<SchemeOption> getSchemesByThresholdQuantity(Decimal thresholdQuantity) {

        if (thresholdQuantity == null || thresholdQuantity <= 0) {
            return new List<SchemeOption>();
        }

        try {
            List<ibfsa__Scheme__c> schemes = [
                SELECT Id, Name,ibfsa__Scheme_Name__c, ibfsa__Discount__c
                FROM ibfsa__Scheme__c
                WHERE ibfsa__Threshold_Quantity__c <= :thresholdQuantity
                AND ibfsa__Active__c = true
                WITH SECURITY_ENFORCED
                ORDER BY ibfsa__Threshold_Quantity__c DESC, ibfsa__Discount__c DESC
            ];


            List<SchemeOption> schemeOptions = new List<SchemeOption>();
            for (ibfsa__Scheme__c s : schemes) {
                Decimal discount = s.ibfsa__Discount__c != null ? s.ibfsa__Discount__c : 0;
                schemeOptions.add(new SchemeOption(s.Id, s.ibfsa__Scheme_Name__c, discount));
            }
            return schemeOptions;
        } catch (Exception ex) {
            return new List<SchemeOption>();
        }
    }

    /* =========================================================
       PLACE ORDER + LINE ITEMS
       ========================================================= */
    @AuraEnabled
    public static Id placeOrder(
        Id franchiseId,
        Id distributorId,
        List<Map<String, Object>> selectedProducts,
        String selectedSchemeId
    ) {


        if (franchiseId == null) {
            throw new AuraHandledException(
                'Please select a franchise before placing the order.'
            );
        }

        if (selectedProducts == null || selectedProducts.isEmpty()) {
            throw new AuraHandledException(
                'Please select at least one product before placing the order.'
            );
        }

        List<ProductOrderWrapper> wrappedProducts = new List<ProductOrderWrapper>();
        Set<Id> productIds = new Set<Id>();

        for (Map<String, Object> productMap : selectedProducts) {

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

            if (wrapper.productId != null) productIds.add(wrapper.productId);

            wrappedProducts.add(wrapper);
        }

        // Load scheme discount if selectedSchemeId is provided
        Decimal schemeDiscount = 0;
        if (selectedSchemeId != null) {
            try {
                Id schemeIdParsed = (Id)selectedSchemeId;
                List<ibfsa__Scheme__c> schemes = [SELECT Id, ibfsa__Discount__c FROM ibfsa__Scheme__c WHERE Id = :schemeIdParsed AND ibfsa__Active__c = true LIMIT 1];
                if (!schemes.isEmpty()) {
                    schemeDiscount = schemes[0].ibfsa__Discount__c == null ? 0 : schemes[0].ibfsa__Discount__c;
                }
            } catch (Exception ex) {
                // Ignore invalid scheme id and proceed without discount.
            }
        }


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


        /* ---------- CREATE LINE ITEMS ---------- */
        List<ibfsa__Order_Line_Item__c> lineItems = new List<ibfsa__Order_Line_Item__c>();


        // We'll compute totals while building line items
        Decimal orderTotal = 0;
        for (ProductOrderWrapper product : wrappedProducts) {
            // Validate product object
            if (product == null) {
                continue;
            }

            // Validate productId
            if (product.productId == null) {
                continue;
            }

            // Validate quantity
            if (product.quantity == null || product.quantity <= 0) {
                continue;
            }

            // compute unit price and discounts
            Decimal unitPrice = product.unitPrice == null ? 0 : product.unitPrice;
            Integer qty = product.quantity == null ? 0 : product.quantity;
            Decimal subtotal = unitPrice * qty;

            // Apply scheme discount (if provided and selected)
            Decimal discountAmount = subtotal * (schemeDiscount / 100);
            Decimal lineTotalAfterDiscount = subtotal - discountAmount;

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

            // store which scheme was applied (if any)
            if (selectedSchemeId != null) {
                try {
                    Id schemeIdParsed = (Id)selectedSchemeId;
                    oli.ibfsa__Scheme__c = schemeIdParsed;
                } catch (Exception e) {
                    oli.put('Scheme__c', selectedSchemeId);
                }
                
            }

            orderTotal += lineTotalAfterDiscount;

            lineItems.add(oli);
        }


        if (!lineItems.isEmpty()) {
            insert lineItems;
        } else {
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
            // Do not block order creation if total update fails.
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
                // Inventory sync is best effort and should not fail the order transaction.
            }
        }

        return order.Id;
    }
}