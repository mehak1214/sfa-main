@IsTest
private class PlaceOrderControllerTest {

    @TestSetup
    static void setup(){

        // Create a Franchise Account
        Account franchise = TestDataFactory.createAccount('Franchise', 'Franchise');
        // Create a Distributor Account
        Account distributor = TestDataFactory.createAccount('Distributor', 'Dealer_Distributor');

        // Create a Product
        Product2 pb1 = TestDataFactory.createVashiProduct('Product 1', true);

        // Link a photo to the product
        TestDataFactory.linkATestPhotoToRecord(pb1.Id);

        // Create a pricebook entry for the product
        PricebookEntry pbe = TestDataFactory.createStdActivePbe(pb1, 100.00);
        
        // Create Inventory for Distributor
        ibfsa__Inventory__c inv =  TestDataFactory.ensureDistributorInventory(distributor.Id);

        // Create Inventory Items
        ibfsa__Inventory_Item__c invItems = TestDataFactory.createInventoryItem(inv, pb1, 100, 10);

        // Create a scheme
        ibfsa__Scheme__c scheme = TestDataFactory.createActiveScheme(10, 10);
        
    }

    // Helper to get ids created in setup
    private static Map<String, Id> getIds() {
        Map<String, Id> res = new Map<String, Id>();

        // Get Franchise Account
        Account franchise = [SELECT Id FROM Account WHERE RecordType.DeveloperName = 'Franchise' LIMIT 1];
        res.put('franchiseId', franchise.Id);

        // Get Distributor Account
        Account distributor = [SELECT Id FROM Account WHERE RecordType.DeveloperName = 'Dealer_Distributor' LIMIT 1];
        res.put('distributorId', distributor.Id);

        // Get Product
        Product2 product = [SELECT Id FROM Product2 LIMIT 1];
        res.put('productId', product.Id);

        // Get Inventory
        ibfsa__Inventory__c inventory = [SELECT Id FROM ibfsa__Inventory__c LIMIT 1];
        res.put('inventoryId', inventory.Id);

        // Get Inventory Item
        ibfsa__Inventory_Item__c inventoryItem = [SELECT Id FROM ibfsa__Inventory_Item__c LIMIT 1];
        res.put('inventoryItemId', inventoryItem.Id);

        // Get Scheme
        ibfsa__Scheme__c scheme = [SELECT Id FROM ibfsa__Scheme__c LIMIT 1];
        res.put('schemeId', scheme.Id);

        return res;
    }

    /* =========================================================
       Test LOAD PRODUCTS BY DISTRIBUTOR
       ========================================================= */
    @IsTest
    static void testLoadProductsByDistributor() {
        Account distributor = [SELECT Id FROM Account WHERE RecordType.DeveloperName = 'Dealer_Distributor' LIMIT 1];

        Test.startTest();
        List<PlaceOrderController.ProductOrderWrapper> pows = PlaceOrderController.getProductsByDistributor(distributor.Id);
        Test.stopTest();
        
        System.Assert.areEqual(1, pows.size(), 'One product should be returned');
    }

    @IsTest
    static void testLoadProductsByDistributor_withNullDistributor() {
        Test.startTest();
        List<PlaceOrderController.ProductOrderWrapper> pows = PlaceOrderController.getProductsByDistributor(null);
        Test.stopTest();
        
        System.Assert.areEqual(0, pows.size(), 'No products should be returned');
    }

    /* =========================================================
       Test LOAD PRODUCTS
       ========================================================= */
    @IsTest
    static void testLoadProducts() {
        Test.startTest();    
        List<PlaceOrderController.ProductOrderWrapper> pows = PlaceOrderController.getProducts();
        Test.stopTest();
        
        System.Assert.areEqual(1, pows.size(), 'One product should be returned');
    }

    /* =========================================================
       Test LOAD FRANCHISE ACCOUNTS
       ========================================================= */
    @IsTest
    static void testLoadFranchiseAccounts() {
        Test.startTest();
        List<Account> accounts = PlaceOrderController.getFranchiseAccounts();
        Test.stopTest();
        
        System.Assert.areEqual(1, accounts.size(), 'One franchise account should be returned');
    }

    /* =========================================================
       Test LOAD DISTRIBUTOR ACCOUNTS
       ========================================================= */
    @IsTest
    static void testLoadDistributorAccounts() {
        Test.startTest();
        List<Account> accounts = PlaceOrderController.getDistributorAccounts();
        Test.stopTest();
        
        System.Assert.areEqual(1, accounts.size(), 'One distributor account should be returned');
    }

    /* =========================================================
       Test LOAD SCHEMES BY THRESHOLD QUANTITY
       ========================================================= */
    @IsTest
    static void testGetSchemesByThresholdQuantity() {
        Test.startTest();
        List<PlaceOrderController.SchemeOption> schemeOptions = PlaceOrderController.getSchemesByThresholdQuantity(10);
        Test.stopTest();
        
        System.Assert.areEqual(true, schemeOptions.size() > 0, 'At least one scheme should be returned');
    }

    /* =========================================================
       Test PLACE ORDER + LINE ITEMS
       ========================================================= */
    @IsTest
    static void testPlaceOrder() {
        Map<String, Id> ids                         = getIds();
        List<Map<String, Object>> productWrapper    = new List<Map<String, Object>>();
        Map<String, Object> productMap              = new Map<String, Object>();

        productMap.put('productId', ids.get('productId'));
        productMap.put('productName', 'Prod A');
        productMap.put('quantity', 10);
        productMap.put('unitPrice', 50);
        productWrapper.add(productMap);


        Test.startTest();
        Id orderId = PlaceOrderController.placeOrder(ids.get('franchiseId'), ids.get('distributorId'), productWrapper, ids.get('schemeId'));
        Test.stopTest();
        
        System.Assert.areEqual(1, [SELECT COUNT() FROM ibfsa__Order__c], 'One order should be created');
    }
    
}