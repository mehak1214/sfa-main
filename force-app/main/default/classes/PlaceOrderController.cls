public with sharing class PlaceOrderController {

    /* =========================================================
       PRODUCT WRAPPER
       ========================================================= */
    public class ProductOrderWrapper {
        @AuraEnabled public Id productId;
        @AuraEnabled public String productName;
        @AuraEnabled public String imageUrl;
        @AuraEnabled public Decimal unitPrice;
        @AuraEnabled public Integer quantity;

        // Default constructor
        public ProductOrderWrapper() {
        }

        // Constructor with parameters for proper deserialization
        public ProductOrderWrapper(Id pId, String pName, String pImageUrl, Integer pQty) {
            this.productId = pId;
            this.productName = pName;
            this.imageUrl = pImageUrl;
            this.quantity = pQty;
        }
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

        // Fetch unit prices from the Standard Pricebook entries for these products
        try {
            List<PricebookEntry> pbes = [
                SELECT Product2Id, UnitPrice, Pricebook2.IsStandard
                FROM PricebookEntry
                WHERE Product2Id IN :productsById.keySet()
                AND IsActive = true
                AND Pricebook2.IsStandard = true
            ];

            for (PricebookEntry pbe : pbes) {
                if (productsById.containsKey(pbe.Product2Id)) {
                    productsById.get(pbe.Product2Id).unitPrice = pbe.UnitPrice;
                }
            }
        } catch (Exception ex) {
            System.debug(' WARNING: Could not fetch PricebookEntry unit prices: ' + ex.getMessage());
        }

        System.debug(' getProducts() completed' +productsById.values());
        return productsById.values();
    }

    /* =========================================================
       LOAD PRODUCTS BY DISTRIBUTOR
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

        System.debug(' Inventory items found: ' + inventoryItems.size());

        // Get unique product IDs from inventory items
        Set<Id> productIds = new Set<Id>();
        for (ibfsa__Inventory_Item__c item : inventoryItems) {
            productIds.add(item.ibfsa__Product__c);
        }

        if (productIds.isEmpty()) {
            System.debug(' No products found for distributor');
            return new List<ProductOrderWrapper>();
        }

        // Get product details
        List<Product2> products = [
            SELECT Id, Name
            FROM Product2
            WHERE Id IN :productIds
            AND IsActive = true
            AND ibfsa__Is_Vashi_Product__c = true
        ];

        System.debug(' Products fetched: ' + products.size());

        Map<Id, ProductOrderWrapper> productsById = new Map<Id, ProductOrderWrapper>();
        
        for (Product2 product : products) {
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

        // Fetch unit prices from the Standard Pricebook entries for these products
        try {
            List<PricebookEntry> pbes = [
                SELECT Product2Id, UnitPrice, Pricebook2.IsStandard
                FROM PricebookEntry
                WHERE Product2Id IN :productsById.keySet()
                AND IsActive = true
                AND Pricebook2.IsStandard = true
            ];

            for (PricebookEntry pbe : pbes) {
                if (productsById.containsKey(pbe.Product2Id)) {
                    productsById.get(pbe.Product2Id).unitPrice = pbe.UnitPrice;
                }
            }
        } catch (Exception ex) {
            System.debug(' WARNING: Could not fetch PricebookEntry unit prices: ' + ex.getMessage());
        }

        System.debug(' getProductsByDistributor() completed' + productsById.values());
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
            ORDER BY Name
        ];

        System.debug(' Franchise accounts found: ' + accts.size());
        return accts;
    }

    /* =========================================================
       LOAD DEALER / DISTRIBUTOR ACCOUNTS
       ========================================================= */
    @AuraEnabled(cacheable=true)
    public static List<Account> getDealerDistributorAccounts() {
        System.debug(' getDealerDistributorAccounts() called');

        List<Account> accts = [
            SELECT Id, Name
            FROM Account
            WHERE RecordType.DeveloperName = 'Dealer_Distributor'
            ORDER BY Name
        ];

        System.debug(' Dealer/Distributor accounts found: ' + accts.size());
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
        if (distributorId == null) {
            System.debug(' ERROR: Distributor ID is NULL');
            throw new AuraHandledException(
                'Please select a dealer/distributor before placing the order.'
            );
        }

        if (selectedProducts == null || selectedProducts.isEmpty()) {
            System.debug(' ERROR: No products received from UI');
            throw new AuraHandledException(
                'Please select at least one product before placing the order.'
            );
        }

        // Convert the Map list to ProductOrderWrapper objects
        List<ProductOrderWrapper> wrappedProducts = new List<ProductOrderWrapper>();
        for (Map<String, Object> productMap : selectedProducts) {
            System.debug(' Converting product map: ' + JSON.serialize(productMap));
            
            ProductOrderWrapper wrapper = new ProductOrderWrapper();
            wrapper.productId   = (Id)productMap.get('productId');
            wrapper.productName = (String)productMap.get('productName');
            wrapper.imageUrl    = (String)productMap.get('imageUrl');
            
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
            
            
            System.debug(' Wrapped product - ID: ' + wrapper.productId + 
                         ' | Name: ' + wrapper.productName + 
                         ' | Qty: ' + wrapper.quantity);
            
            wrappedProducts.add(wrapper);
        }

        System.debug(' Total wrapped products: ' + wrappedProducts.size());

        // Build a map of ProductId -> total ordered quantity (used for pricing and inventory)
        Map<Id, Integer> productQtyMapForProcessing = new Map<Id, Integer>();
        for (ProductOrderWrapper p : wrappedProducts) {
            if (p == null || p.productId == null || p.quantity == null) continue;
            Integer existing = productQtyMapForProcessing.containsKey(p.productId) ? productQtyMapForProcessing.get(p.productId) : 0;
            productQtyMapForProcessing.put(p.productId, existing + p.quantity);
        }

        // Calculate total price using UnitPrice from Standard Pricebook
        Decimal totalOrderPrice = 0;
        try {
            if (!productQtyMapForProcessing.isEmpty()) {
                List<PricebookEntry> pbesForCalc = [
                    SELECT Product2Id, UnitPrice, Pricebook2.IsStandard
                    FROM PricebookEntry
                    WHERE Product2Id IN :productQtyMapForProcessing.keySet()
                    AND IsActive = true
                    AND Pricebook2.IsStandard = true
                ];

                Map<Id, Decimal> unitPriceByProduct = new Map<Id, Decimal>();
                for (PricebookEntry pbe : pbesForCalc) {
                    if (!unitPriceByProduct.containsKey(pbe.Product2Id)) {
                        unitPriceByProduct.put(pbe.Product2Id, pbe.UnitPrice == null ? 0 : pbe.UnitPrice);
                    }
                }

                for (Id pid : productQtyMapForProcessing.keySet()) {
                    Integer qty = productQtyMapForProcessing.get(pid) == null ? 0 : productQtyMapForProcessing.get(pid);
                    Decimal unit = unitPriceByProduct.containsKey(pid) ? unitPriceByProduct.get(pid) : 0;
                    totalOrderPrice += unit * qty;
                }
            }
        } catch (Exception ex) {
            System.debug(' WARNING: Failed to calculate total order price: ' + ex.getMessage());
        }

        /* ---------- CREATE ORDER ---------- */
        ibfsa__Order__c order = new ibfsa__Order__c(
            ibfsa__Franchises__c   = franchiseId,
            ibfsa__Distributer__c  = distributorId,
            ibfsa__Order_Date__c   = Date.today(),
            ibfsa__Total_Price__c  = totalOrderPrice
        );

        insert order;

        System.debug(' Order created with Id: ' + order.Id);

        /* ---------- FETCH PRODUCT PRICES FROM PRICEBOOK ---------- */
        Map<Id, Decimal> productPriceMap = new Map<Id, Decimal>();
        try {
            Set<Id> productIds = new Set<Id>();
            for (ProductOrderWrapper p : wrappedProducts) {
                if (p != null && p.productId != null) {
                    productIds.add(p.productId);
                }
            }
            
            if (!productIds.isEmpty()) {
                List<PricebookEntry> pbes = [
                    SELECT Product2Id, UnitPrice
                    FROM PricebookEntry
                    WHERE Product2Id IN :productIds
                    AND IsActive = true
                    AND Pricebook2.IsStandard = true
                ];
                
                for (PricebookEntry pbe : pbes) {
                    if (!productPriceMap.containsKey(pbe.Product2Id)) {
                        productPriceMap.put(pbe.Product2Id, pbe.UnitPrice == null ? 0 : pbe.UnitPrice);
                    }
                }
            }
        } catch (Exception ex) {
            System.debug(' WARNING: Could not fetch product prices: ' + ex.getMessage());
        }

        /* ---------- CREATE LINE ITEMS ---------- */
        List<ibfsa__Order_Line_Item__c> lineItems = new List<ibfsa__Order_Line_Item__c>();

        System.debug(' Creating line items for ' + wrappedProducts.size() + ' products');

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

            // Get price from productPriceMap
            Decimal productPrice = productPriceMap.containsKey(product.productId) ? productPriceMap.get(product.productId) : 0;

            System.debug(
                ' Creating line item - Product ID: ' + product.productId +
                ' | Quantity: ' + product.quantity +
                ' | Price: ' + productPrice
            );

            ibfsa__Order_Line_Item__c oli =
                new ibfsa__Order_Line_Item__c(
                    ibfsa__Order__c    = order.Id,
                    ibfsa__Product__c  = product.productId,
                    ibfsa__Quantity__c = product.quantity,
                   ibfsa__Unit_Price__c    = productPrice,
                   ibfsa__Total_Price__c   = productPrice * product.quantity
                );

            lineItems.add(oli);
            System.debug(' Line item created for product: ' + product.productId + ' with qty: ' + product.quantity );
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

        /* ---------- UPDATE INVENTORY AVAILABLE STOCK ---------- */
        try {
            // Build a map of ProductId -> total ordered quantity
            Map<Id, Integer> productQtyMap = new Map<Id, Integer>();
            for (ProductOrderWrapper p : wrappedProducts) {
                if (p == null || p.productId == null || p.quantity == null) continue;
                Integer existing = productQtyMap.containsKey(p.productId) ? productQtyMap.get(p.productId) : 0;
                productQtyMap.put(p.productId, existing + p.quantity);
            }

            if (!productQtyMap.isEmpty()) {
                // Query inventory items for the distributor's inventories matching these products
                List<ibfsa__Inventory_Item__c> invItems = [
                    SELECT Id, ibfsa__Product__c, ibfsa__AvailableStock__c
                    FROM ibfsa__Inventory_Item__c
                    WHERE ibfsa__Inventory__c IN (
                        SELECT Id FROM ibfsa__Inventory__c WHERE ibfsa__Dealer__c = :distributorId
                    )
                    AND ibfsa__Product__c IN :productQtyMap.keySet()
                ];

                // Subtract ordered quantities from available stock (do not allow negative stock)
                for (ibfsa__Inventory_Item__c inv : invItems) {
                    Integer orderedQty = productQtyMap.get(inv.ibfsa__Product__c);
                    Integer currentStock = inv.ibfsa__AvailableStock__c == null ? 0 : inv.ibfsa__AvailableStock__c.intValue();
                    Integer newStock = currentStock - (orderedQty == null ? 0 : orderedQty);
                    if (newStock < 0) newStock = 0;
                    inv.ibfsa__AvailableStock__c = newStock;
                }

                if (!invItems.isEmpty()) {
                    update invItems;
                    System.debug(' Inventory updated for ' + invItems.size() + ' inventory items');
                }
            }
        } catch (Exception ex) {
            System.debug(' WARNING: Failed to update inventory stock: ' + ex.getMessage());
            // Do not block order placement for inventory update failures, but surface a warning
        }

        System.debug(' placeOrder() completed successfully. Order ID: ' + order.Id);
        return order.Id;
    }
}