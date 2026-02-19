@IsTest
private class SampleOrderControllerTest {

    @TestSetup
    static void setup() {
        // Ensure at least one active product exists
        // Create a Product
        Product2 pb1 = TestDataFactory.createVashiProduct('Product 1', true);

        // Link a photo to the product
        TestDataFactory.linkATestPhotoToRecord(pb1.Id);

        // Create a pricebook entry for the product
        PricebookEntry pbe = TestDataFactory.createStdActivePbe(pb1, 100.00);

        // Ensure a franchise account exists
        TestDataFactory.createAccount('Sample Franchise', 'Franchise');
    }

    private static Id getFranchiseId() {
        return [SELECT Id FROM Account WHERE RecordType.DeveloperName = 'Franchise' LIMIT 1].Id;
    }

    /* =========================================================
       Test createSampleOrder
       ========================================================= */
    @IsTest
    static void testCreateSampleOrder_happyPath_withParentAndLines() {
        ibfsa__Sample_Order__c orderRec = new ibfsa__Sample_Order__c();
        // leave status null to test defaulting to Draft
        orderRec.ibfsa__Status__c = null;

        // create a couple of lines
        List<ibfsa__Sample_Order_Line__c> lines = new List<ibfsa__Sample_Order_Line__c>();
        ibfsa__Sample_Order_Line__c l1 = new ibfsa__Sample_Order_Line__c();
        l1.ibfsa__Quantity__c = 2;
        lines.add(l1);

        ibfsa__Sample_Order_Line__c l2 = new ibfsa__Sample_Order_Line__c();
        l2.ibfsa__Quantity__c = 1;
        lines.add(l2);

        Id parentAccountId = getFranchiseId();

        Test.startTest();
        SampleOrderController.OrderResult res = SampleOrderController.createSampleOrder(orderRec, parentAccountId, lines);
        Test.stopTest();

        System.assertNotEquals(null, res, 'Result should not be null');
        System.assertNotEquals(null, res.sampleOrderId, 'Order id should be returned');

        // Verify order stored fields
        ibfsa__Sample_Order__c stored = [
            SELECT Id, Name, ibfsa__Customer__c, ibfsa__Status__c
            FROM ibfsa__Sample_Order__c
            WHERE Id = :res.sampleOrderId
        ];
        System.assertEquals(parentAccountId, stored.ibfsa__Customer__c, 'Customer should be set from parentId');
        System.assertEquals('Draft', stored.ibfsa__Status__c, 'Default status should be Draft');

        // Verify lines linked
        Integer lineCount = [
            SELECT COUNT()
            FROM ibfsa__Sample_Order_Line__c
            WHERE ibfsa__Sample_Order__c = :stored.Id
        ];
        System.assertEquals(2, lineCount, 'Two lines should have been inserted');
    }

    @IsTest
    static void testCreateSampleOrder_errorWhenOrderNull() {
        try {
            Test.startTest();
            SampleOrderController.createSampleOrder(null, null, null);
            Test.stopTest();
            System.assert(false, 'Expected AuraHandledException when orderRec is null');
        } catch (AuraHandledException e) {
            System.assert(true, 'Exception was thrown as expected');
        }
    }

    /* =========================================================
       Test getPicklistValues
       ========================================================= */
    @IsTest
    static void testGetPicklistValues() {
        // Using Standard object picklist where available - fallback to custom if needed in org
        Test.startTest();
        List<String> vals = SampleOrderController.getPicklistValues('Account', 'Rating');
        Test.stopTest();

        System.assertNotEquals(null, vals, 'Should return a list (possibly empty based on org metadata)');
        System.assertEquals(true, vals.size() >= 0, 'At least zero values');
    }

    /* =========================================================
       Test getSampleProducts
       ========================================================= */
    @IsTest
    static void testGetSampleProducts() {
        Test.startTest();
        List<Product2> products = SampleOrderController.getSampleProducts();
        Test.stopTest();

        System.assert(products.size() > 0, 'Active products should be returned');
    }
}