@IsTest
private class Outlet360ControllerTest {
    @IsTest
    static void getOutlet360Summary_returnsRelatedCounts() {
        Account outlet = new Account(Name = 'Outlet 360 Test');
        insert outlet;

        Contact c = new Contact(LastName = 'Test Contact', AccountId = outlet.Id);
        insert c;

        Test.startTest();
        Outlet360Controller.Outlet360Response response =
            Outlet360Controller.getOutlet360Summary(outlet.Id, 'Account');
        Test.stopTest();

        System.assertNotEquals(null, response, 'Response should be returned');
        System.assert(response.scannedRelationships > 0, 'At least one relationship should be scanned');
        System.assert(response.totalRelationships > 0, 'Account should have child relationships');

        Boolean foundAnyRelatedList = false;
        for (Outlet360Controller.RelatedListCount item : response.relatedLists) {
            if (item != null && item.recordCount != null && item.recordCount > 0) {
                foundAnyRelatedList = true;
                break;
            }
        }
        System.assert(foundAnyRelatedList, 'At least one related list with records should be present');
    }

    @IsTest
    static void getOutlet360Summary_resolvesObjectFromRecordId() {
        Account outlet = new Account(Name = 'Outlet 360 Resolve Test');
        insert outlet;

        Test.startTest();
        Outlet360Controller.Outlet360Response response =
            Outlet360Controller.getOutlet360Summary(outlet.Id, null);
        Test.stopTest();

        System.assertNotEquals(null, response, 'Response should be returned when object name is omitted');
    }
}