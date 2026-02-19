/**
 * @description Unit tests for VisitController.
 * Follows a4d rules: no SeeAllData, @TestSetup data, bulk-safe, meaningful assertions.
 */
@IsTest
private class VisitControllerTest {

    private static Map<String, Id> ids;

    @TestSetup
    static void setupData() {
        // Running user as Sales Rep
        User rep = TestDataFactory.getRunningUser();

        // Create two outlets
        Account outlet1 = TestDataFactory.createAccount('Outlet One', 'Franchise');
        Account outlet2 = TestDataFactory.createAccount('Outlet Two', 'Franchise');

        // Create a beat
        Beat__c beat = TestDataFactory.createBeat(rep, true);

        // Two visits for today
        TestDataFactory.createVisitApproved(rep, outlet1, beat, 1, Date.today());
        TestDataFactory.createVisitApproved(rep, outlet2, beat, 2, Date.today());

        // Attach a photo to outlet1
        TestDataFactory.linkATestPhotoToRecord(outlet1.Id);
    }

    // Helper to get ids created in setup
    private static Map<String, Id> getIds() {
        Map<String, Id> res = new Map<String, Id>();

        Beat__c b = [SELECT Id FROM Beat__c LIMIT 1];
        res.put('beatId', b.Id);

        // Select two franchise outlets created in setup
        List<Account> outlets = [
            SELECT Id, Name
            FROM Account
            WHERE RecordType.DeveloperName = 'Franchise'
            ORDER BY CreatedDate 
            LIMIT 2
        ];
        for(Account a : outlets) {
            if(a.Name == 'Outlet One') res.put('outlet1Id', a.Id);
            if(a.Name == 'Outlet Two') res.put('outlet2Id', a.Id);   
        }
        
        // Select two visits for today created in @TestSetup
        List<Visit__c> visits = [
            SELECT Id
            FROM Visit__c
            WHERE ibfsa__Visit_Date__c = :Date.today()
            ORDER BY Name 
            LIMIT 2
        ];
        res.put('visit1Id', visits[0].Id);
        res.put('visit2Id', visits[1].Id);
        return res;
    }

    /* =========================================================
       TEST START DAY
    ========================================================= */
    @IsTest
    static void testStartDay() {

        Test.startTest();
        Id attId = VisitController.startDay('12.34', '77.56');
        Test.stopTest();

        System.assertNotEquals(null, attId, 'Attendance Id should be returned');
    }

    /* =========================================================
       TEST TODAY ATTENDANCE
    ========================================================= */
    @isTest
    static void testGetTodayAttendanceNull() {
        Test.startTest();
        Day_Attendance__c att = VisitController.getTodayAttendance();
        Test.stopTest();

        System.assertEquals(null, att, 'No attendance should exist');
    }

    @isTest
    static void testGetTodayAttendanceNotNull() {

        // Start Day
        Id attId = VisitController.startDay('12.34', '77.56');

        Test.startTest();
        Day_Attendance__c att = VisitController.getTodayAttendance();
        Test.stopTest();

        System.assertNotEquals(null, att, 'Attendance should exist');
    }

    /* =========================================================
       TEST TODAY BEATS
    ========================================================= */
    @isTest
    static void testGetTodayBeats() {
        // Start Day
        Id attId = VisitController.startDay('12.34', '77.56');

        Test.startTest();
        List<Beat__c> beats = VisitController.getTodayBeats(Date.today());
        Test.stopTest();
        
        System.assertEquals(true, beats.size() >= 1, 'At least one beat expected');
    }

    /* =========================================================
        TEST DAY TIMELINE – ALL VISITS
    ========================================================= */
    @isTest
    static void testGetDayTimeline() {
        // Start Day
        Id attId = VisitController.startDay('12.34', '77.56');

        Test.startTest();
        List<Visit__c> visits = VisitController.getDayTimeline(Date.today());
        Test.stopTest();

        System.assertEquals(true, visits.size()>=1, 'Should retrieve visits for today');
    }

    /* =========================================================
       TEST VISITS BY BEAT ( FIXED)
    ========================================================= */
    @isTest
    static void testGetVisitsByBeat() {
        Map<String, Id> ids = getIds();
        // Start Day
        Id attId = VisitController.startDay('12.34', '77.56');

        Test.startTest();
        List<Visit__c> visits = VisitController.getVisitsByBeat(ids.get('beatId'), Date.today());
        Test.stopTest();
        
        System.assertEquals(true, visits.size()>=1, 'Should retrieve visits for today');
    }

    /* =========================================================
       TEST VISIT DETAIL (FOR DETAIL PAGE)
    ========================================================= */
    @IsTest
    static void testGetVisitDetail() {
        Map<String, Id> ids = getIds();

        Test.startTest();
        Visit__c v = VisitController.getVisitDetail(ids.get('visit1Id'));
        Test.stopTest();
        
        System.assertNotEquals(null, v, 'Visit detail should return a record');
    }

    /* =========================================================
       TEST OUTLET PHOTO (Account File)
    ========================================================= */
    @IsTest
    static void testGetOutletPhotoNull() {
        Map<String, Id> ids = getIds();

        Test.startTest();
        ContentVersion cv = VisitController.getOutletPhoto(ids.get('outlet2Id'));
        Test.stopTest();

        System.assertEquals(null, cv, 'Should return null for account with no photo');
    }

    @IsTest
    static void testGetOutletPhotoNotNull() {
        Map<String, Id> ids = getIds();

        Test.startTest();
        ContentVersion cv = VisitController.getOutletPhoto(ids.get('outlet1Id'));
        Test.stopTest();

        System.assertEquals(true, cv != null, 'Should fetch outlet photo');
    }

    /* =========================================================
       TEST CHECK IN VISIT
    ========================================================= */
    @IsTest
    static void testCheckInVisitFirst() {
        Map<String, Id> ids = getIds();
        // Start Day
        Id attId = VisitController.startDay('12.34', '77.56');
        
        Test.startTest();
        VisitController.checkInVisit(ids.get('visit1Id'), '11.00', '21.00');
        Test.stopTest();
        
        Visit__c v = [SELECT Id, ibfsa__Check_In_Time__c, ibfsa__Check_Out_Time__c FROM Visit__c WHERE Id = :ids.get('visit1Id')];
        System.assertNotEquals(null, v.ibfsa__Check_In_Time__c, 'Check-in time set');
        System.assertEquals(null, v.ibfsa__Check_Out_Time__c, 'Check-out time not set');
    }
        
    @IsTest
    static void testCheckInVisitSecond() {
        Map<String, Id> ids = getIds();
        // Start Day
        Id attId = VisitController.startDay('12.34', '77.56');
        
        VisitController.checkInVisit(ids.get('visit1Id'), '11.00', '21.00');
        
        // Check-in second visit should not be possible (previous is in progress)
        try {
            VisitController.checkInVisit(ids.get('visit2Id'), '14.00', '78.00');
            System.assert(false, 'Should have thrown for invalid check-in');
        }
        catch (AuraHandledException e) {
            // Allow for different exception handling in org - just verify it's an AuraHandledException
            System.assert(true, 'Caught expected AuraHandledException for invalid check-in');
        }
    }    

    /* =========================================================
       TEST CHECK OUT VISIT
    ========================================================= */
    @IsTest
    static void testCheckOutVisit() {
        Map<String, Id> ids = getIds();
        // Start Day
        Id attId = VisitController.startDay('12.34', '77.56');
        
        VisitController.checkInVisit(ids.get('visit1Id'), '11.00', '21.00');
        
        Test.startTest();
        VisitController.checkOutVisit(ids.get('visit1Id'), '11.00', '21.00');
        Test.stopTest();
        
        Visit__c v = [SELECT Id, ibfsa__Check_In_Time__c, ibfsa__Check_Out_Time__c FROM Visit__c WHERE Id = :ids.get('visit1Id')];
        System.assertNotEquals(null, v.ibfsa__Check_In_Time__c, 'Check-in time set');
        System.assertNotEquals(null, v.ibfsa__Check_Out_Time__c, 'Check-out time set');
    }

    /* =========================================================
       TEST END DAY
    ========================================================= */
    @IsTest
    static void testEndDay() {
        Map<String, Id> ids = getIds();
        // Start Day
        Id attId = VisitController.startDay('12.34', '77.56');
        
        VisitController.checkInVisit(ids.get('visit1Id'), '11.00', '21.00');
        
        Test.startTest();
        VisitController.endDay('12.34', '77.56');
        Test.stopTest();
        
        Day_Attendance__c att = [SELECT Id, End_Location__Latitude__s, End_Location__Longitude__s FROM Day_Attendance__c WHERE Id = :attId];
        System.assertEquals(Decimal.valueOf('12.34'), att.End_Location__Latitude__s, 'End location set');
        System.assertEquals(Decimal.valueOf('77.56'), att.End_Location__Longitude__s, 'End location set');
    }

    /* =========================================================
       TEST Upload Photo
    ========================================================= */
    @IsTest
    static void testUploadVisitPhoto() {
        Map<String, Id> ids = getIds();
        // Start Day
        Id attId = VisitController.startDay('12.34', '77.56');
        
        VisitController.checkInVisit(ids.get('visit1Id'), '11.00', '21.00');
        
        // Test successful photo upload
        Test.startTest();
        Id contentVersionId = VisitController.uploadVisitPhoto(
            ids.get('visit1Id'),
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
            'image/jpeg'
        );
        Test.stopTest();
        
        // Verify that a ContentVersion was created
        System.assertNotEquals(null, contentVersionId, 'ContentVersion ID should be returned');
        
        // Verify the photo is linked to the visit
        ContentVersion cv = VisitController.getVisitPhoto(ids.get('visit1Id'));
        System.assertNotEquals(null, cv, 'Should retrieve the uploaded photo');
    }
        
    @IsTest
    static void testUploadVisitPhoto_nullVisitId() {
        Map<String, Id> ids = getIds();
        // Start Day
        Id attId = VisitController.startDay('12.34', '77.56');
        
        VisitController.checkInVisit(ids.get('visit1Id'), '11.00', '21.00');
        
        // Test successful photo upload
        Test.startTest();
        try {
            VisitController.uploadVisitPhoto(null, 'testData', 'image/jpeg');
            System.assert(false, 'Should have thrown for null visit ID');
        } catch (AuraHandledException e) {
            System.assert(true, 'Caught expected AuraHandledException for null visit ID');
        }
        Test.stopTest();
    }

    @IsTest
    static void testUploadVisitPhoto_blankBase64Data() {
        Map<String, Id> ids = getIds();
        // Start Day
        Id attId = VisitController.startDay('12.34', '77.56');
        
        VisitController.checkInVisit(ids.get('visit1Id'), '11.00', '21.00');
        
        // Test successful photo upload
        Test.startTest();
        try {
            VisitController.uploadVisitPhoto(ids.get('visit1Id'), '', 'image/jpeg');
            System.assert(false, 'Should have thrown for blank base64 data');
        } catch (AuraHandledException e) {
            System.assert(true, 'Caught expected AuraHandledException for blank base64 data');
        }
        Test.stopTest();
    }

    @IsTest
    static void testUploadVisitPhoto_invalidBase64Data() {
        Map<String, Id> ids = getIds();
        // Start Day
        Id attId = VisitController.startDay('12.34', '77.56');
        
        VisitController.checkInVisit(ids.get('visit1Id'), '11.00', '21.00');
        
        // Test successful photo upload
        Test.startTest();
        try {
            VisitController.uploadVisitPhoto(ids.get('visit1Id'), 'invalid_base64_data', 'image/jpeg');
            System.assert(false, 'Should have thrown for invalid base64 data');
        } catch (AuraHandledException e) {
            System.assert(true, 'Caught expected AuraHandledException for invalid base64 data');
        }
        Test.stopTest();
    }

    /* =========================================================
       TEST Get Visit Photo
    ========================================================= */
    @IsTest
    static void testGetVisitPhoto() {
        Map<String, Id> ids = getIds();
        // Start Day
        Id attId = VisitController.startDay('12.34', '77.56');
        
        VisitController.checkInVisit(ids.get('visit1Id'), '11.00', '21.00');
        VisitController.uploadVisitPhoto(ids.get('visit1Id'), 'testData', 'image/jpeg');
        
        // Test successful photo upload
        Test.startTest();
        ContentVersion cv = VisitController.getVisitPhoto(ids.get('visit1Id'));
        Test.stopTest();

        System.Assert.areEqual(true, cv != null, 'Should fetch visit photo');
    }

    /* =========================================================
       TEST Delete Visit Photo
    ========================================================= */
    @IsTest
    static void testDeleteVisitPhoto() {
        Map<String, Id> ids = getIds();
        // Start Day
        Id attId = VisitController.startDay('12.34', '77.56');
        
        VisitController.checkInVisit(ids.get('visit1Id'), '11.00', '21.00');
        VisitController.uploadVisitPhoto(ids.get('visit1Id'), 'testData', 'image/jpeg');
        
        // Test successful photo upload
        Test.startTest();
        ContentVersion cv = VisitController.getVisitPhoto(ids.get('visit1Id'));
        VisitController.deleteVisitPhoto(cv.Id);
        Test.stopTest();
        
        System.Assert.areEqual(true, VisitController.getVisitPhoto(ids.get('visit1Id')) == null, 'Should delete visit photo');
    }

}