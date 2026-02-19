@IsTest
private class DistributorInventoryServiceTest {

    @TestSetup
    static void setup() {
        // Ensure at least one active Vashi product with price for inventory items
        TestDataFactory.createVashiProduct('P1', true);
        TestDataFactory.createVashiProduct('P2', true);
    }

    // When Franchise Account is inserted, DistributorInventoryService should not create inventory
    @IsTest
    static void testAfterInsertFranchiseNoInventory() {

        Test.startTest();
        Account franchise = TestDataFactory.prepareAccount('Franchise-Ins', 'Franchise');
        Test.stopTest();

        Integer invCount = [
            SELECT COUNT()
            FROM ibfsa__Inventory__c
            WHERE ibfsa__Dealer__c = :franchise.Id
        ];
        System.assertEquals(0, invCount, 'Inventory should not be created for Franchise');
    }   

    // When Franchise Account is updated to Dealer_Distributor, DistributorInventoryService should create inventory
    @IsTest
    static void testAfterUpdateFranchiseToDealerCreatesInventory() {
        Account franchise = TestDataFactory.createAccount('Franchise-Update', 'Franchise');
        franchise.RecordTypeId = TestDataFactory.getDealerDistributorRtId();
        
        Test.startTest();
        update franchise;
        Test.stopTest();
        
        ibfsa__Inventory__c inv = [
            SELECT Id, ibfsa__Dealer__c FROM ibfsa__Inventory__c WHERE ibfsa__Dealer__c = :franchise.Id LIMIT 1
        ];
        System.assertNotEquals(null, inv, 'Inventory should be created after update via trigger');
    }

    // When Dealer_Distributor Account is inserted, DistributorInventoryService should create inventory
    @IsTest
    static void testAfterInsertDelearAccount(){
        Account dealer = TestDataFactory.prepareAccount('Dealer-Ins', 'Dealer_Distributor');
        
        Test.startTest();
        insert dealer; // fires AccountInventoryTrigger
        Test.stopTest();
        
        ibfsa__Inventory__c inv = [
            SELECT Id, ibfsa__Dealer__c FROM ibfsa__Inventory__c WHERE ibfsa__Dealer__c = :dealer.Id LIMIT 1
        ];
        System.assertNotEquals(null, inv, 'Inventory should be created after insert via trigger');
    }

}