/**
 * TestDataFactory
 * Centralized factory for creating test data across tests.
 */
@IsTest
public with sharing class TestDataFactory {

    // Utilities
    public static Date today() { return Date.today(); }
    public static Datetime now() { return Datetime.now(); }

    // User helper: returns the running user as Sales Rep context
    public static User getRunningUser() {
        return [SELECT Id, ProfileId FROM User WHERE Id = :UserInfo.getUserId()];
    }

    public static Id getDealerDistributorRtId() {
        return Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName().get('Dealer_Distributor').getRecordTypeId();
    }

    public static Id getFranchiseRtId() {
        return Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName().get('Franchise').getRecordTypeId();
    }

    // Account
    public static Account prepareAccount(String name, String rtDevName) {
        Account a                          = new Account();

        a.Name                                  = name;
        a.RecordTypeId                          = Schema.SObjectType.Account.getRecordTypeInfosByDeveloperName().get(rtDevName).getRecordTypeId();
        a.ShippingStreet                        = '123 Main St';
        a.ShippingCity                          = 'Anytown';
        a.ShippingState                         = 'CA';
        a.ShippingPostalCode                    = '12345';
        a.ShippingCountry                       = 'USA';
        
        if(rtDevName == 'Franchise') {
            a.ibfsa__OutletStatus__c                = 'Active';
            a.ibfsa__Active__c                      = 'Yes';
            a.ibfsa__Outlet_Code__c                 = String.valueOf(Math.mod(now().getTime(), 99999));
            a.ibfsa__Outlet_Location__Latitude__s   = 37.7749;
            a.ibfsa__Outlet_Location__Longitude__s  = -122.4194;
        }
        return a;
    }

    public static Account createAccount(String name, String rtDevName) {
        Account a =  prepareAccount(name, rtDevName);
        insert a;
        return a;
    }

    // Create a test image and link it with a record Id using Content Document Link
    public static void linkATestPhotoToRecord(Id recordId) {
        ContentVersion cv   = new ContentVersion(
            Title           = 'Test Image ' + now().getTime(),
            PathOnClient    = 'test.jpg',
            VersionData     = Blob.valueOf('Test Image'),
            IsMajorVersion  = true
        );
        insert cv;

        ContentVersion cvWithDocId = [
            SELECT Id, ContentDocumentId FROM ContentVersion WHERE Id = :cv.Id LIMIT 1
        ];

        ContentDocumentLink cdl = new ContentDocumentLink(
            LinkedEntityId      = recordId,
            ContentDocumentId   = cvWithDocId.ContentDocumentId,
            ShareType           = 'V',
            Visibility          = 'AllUsers'
        );
        insert cdl;
    }

    // Beat
    public static Beat__c createBeat(User salesRep, Boolean active) {
        Beat__c b               = new Beat__c();
        b.Name                  = 'Beat ' + now().getTime();
        b.ibfsa__Sales_Rep__c   = salesRep.Id;
        b.ibfsa__Active__c      = active;
        insert b;
        return b;
    }

    // Visit
    public static Visit__c createVisitApproved(User rep, Account outlet, Beat__c beat, Integer seq, Date vDate) {
        Visit__c v                      = new Visit__c();
        v.ibfsa__Sales_Rep__c           = rep.Id;
        v.ibfsa__Sequence__c            = seq;
        v.ibfsa__Visit_Date__c          = vDate;
        v.ibfsa__Outlet1__c             = outlet.Id;
        v.ibfsa__Beat__c                = beat.Id;
        v.ibfsa__Visit_Status__c        = 'Approved';
        v.ibfsa__Planned_Start_Time__c  = now();
        v.ibfsa__Planned_End_Time__c    = now().addHours(1);
        insert v;
        return v;
    }

    // Attendance
    public static Day_Attendance__c createStartedAttendance(User rep) {
        Day_Attendance__c att               = new Day_Attendance__c();
        att.Sales_Rep__c                    = rep.Id;
        att.Attendance_Date__c              = today();
        att.Start_Time__c                   = now();
        att.Start_Location__Latitude__s     = 12.34;
        att.Start_Location__Longitude__s    = 77.56;
        insert att;
        return att;
    }

    // Product
    public static Product2 createVashiProduct(String name, Boolean active) {
        Product2 p                   = new Product2();
        p.Name                       = name;
        p.IsActive                   = active;
        p.ibfsa__Is_Vashi_Product__c = true;
        insert p;
        return p;
    }

    // Pricebook Entry
    public static PricebookEntry createStdActivePbe(Product2 product, Decimal unitPrice) {
        PricebookEntry pbe  = new PricebookEntry();
        pbe.Product2Id      = product.Id;
        pbe.Pricebook2Id    = Test.getStandardPricebookId();
        pbe.UnitPrice       = unitPrice;
        pbe.IsActive        = true;
        insert pbe;
        return pbe;
    }

    // Scheme
    public static ibfsa__Scheme__c createActiveScheme(Decimal thresholdQty, Decimal discount) {
        ibfsa__Scheme__c s = new ibfsa__Scheme__c();
        s.ibfsa__Threshold_Quantity__c  = thresholdQty;
        s.ibfsa__Discount__c            = discount;
        s.ibfsa__Active__c              = true;
        insert s;
        return s;
    }

    // Inventory and Inventory Items for a Distributor
    public static ibfsa__Inventory__c ensureDistributorInventory(Id distributorId) {
        List<ibfsa__Inventory__c> existing = [
            SELECT Id FROM ibfsa__Inventory__c WHERE ibfsa__Dealer__c = :distributorId LIMIT 1
        ];
        if (!existing.isEmpty()) return existing[0];
        ibfsa__Inventory__c inv = new ibfsa__Inventory__c();
        inv.ibfsa__Dealer__c    = distributorId;
        inv.Status__c           = 'Active';
        insert inv;
        return inv;
    }

    public static ibfsa__Inventory_Item__c createInventoryItem(ibfsa__Inventory__c inv, Product2 product, Decimal avail, Decimal minThreshold) {
        ibfsa__Inventory_Item__c item           = new ibfsa__Inventory_Item__c();
        item.ibfsa__Inventory__c                = inv.Id;
        item.ibfsa__Product__c                  = product.Id;
        item.ibfsa__AvailableStock__c           = avail;
        item.ibfsa__MinimumThresholdQuantity__c = minThreshold;

        insert item;
        return item;

    }
}