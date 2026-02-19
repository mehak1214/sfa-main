public with sharing class VisitController {

    /* =========================================================
       START DAY
    ========================================================= */
    @AuraEnabled
    public static Id startDay(String lat, String lon) {
        if (String.isBlank(lat) || String.isBlank(lon)) {
            throw new AuraHandledException('Location permission is required.');
        }

        Id userId = UserInfo.getUserId();
        Date today = Date.today();

        if (![
            SELECT Id
            FROM Day_Attendance__c
            WHERE Sales_Rep__c = :userId
            AND Attendance_Date__c = :today
            LIMIT 1
        ].isEmpty()) {
            throw new AuraHandledException('Day already started.');
        }

        Day_Attendance__c att = new Day_Attendance__c();
        att.Sales_Rep__c = userId;
        att.Attendance_Date__c = today;
        att.Start_Time__c = System.now();
        att.Start_Location__Latitude__s  = Decimal.valueOf(lat);
        att.Start_Location__Longitude__s = Decimal.valueOf(lon);

        insert att;

        // Travel distance tracking should not block day start.
        try {
            TravelDistanceService.logPoint(
                att.Id,
                null,
                'START_DAY',
                Decimal.valueOf(lat),
                Decimal.valueOf(lon),
                att.Start_Time__c
            );
            TravelDistanceService.recalculateAttendanceDistance(att.Id);
        } catch (Exception ex) {
        }

        return att.Id;
    }

    /* =========================================================
       TODAY ATTENDANCE
    ========================================================= */
    @AuraEnabled(cacheable=true)
    public static Day_Attendance__c getTodayAttendance() {
        List<Day_Attendance__c> listAtt = [
            SELECT Id, Start_Time__c, End_Time__c
            FROM Day_Attendance__c
            WHERE Sales_Rep__c = :UserInfo.getUserId()
            AND Attendance_Date__c = :Date.today()
            LIMIT 1
        ];
        return listAtt.isEmpty() ? null : listAtt[0];
    }

    @AuraEnabled
    public static TravelDistanceService.TravelSummary getTodayTravelSummary() {
        return TravelDistanceService.getTodayTravelSummary();
    }

    @AuraEnabled
    public static TravelDistanceService.TravelSummary getTravelSummaryByDate(String visitDate) {
        Date targetDate = Date.today();
        if (!String.isBlank(visitDate)) {
            try {
                targetDate = Date.valueOf(visitDate);
            } catch (Exception ex) {
                try {
                    targetDate = Datetime.valueOfGmt(visitDate).dateGmt();
                } catch (Exception ignored) {
                    targetDate = Date.today();
                }
            }
        }
        return TravelDistanceService.getTravelSummaryByDate(targetDate);
    }

    /* =========================================================
       TODAY BEATS
    ========================================================= */
    @AuraEnabled(cacheable=true)
    public static List<Beat__c> getTodayBeats(Date visitDate) {
        if (visitDate == null) {
            visitDate = Date.today();
        }

        Set<Id> beatIds = new Set<Id>();
        for (AggregateResult ar : [
            SELECT ibfsa__Beat__c beatId
            FROM Visit__c
            WHERE ibfsa__Sales_Rep__c = :UserInfo.getUserId()
            AND ibfsa__Visit_Date__c = :visitDate
            AND ibfsa__Beat__c != null
            GROUP BY ibfsa__Beat__c
        ]) {
            beatIds.add((Id) ar.get('beatId'));
        }

        if (beatIds.isEmpty()) {
            return new List<Beat__c>();
        }

        Map<String, Schema.SObjectField> fieldMap = Schema.SObjectType.Beat__c.fields.getMap();
        List<String> selectFields = new List<String>{ 'Id', 'Name', 'ibfsa__Active__c' };

        if (fieldMap.containsKey('Start_Day__c')) {
            selectFields.add('Start_Day__c');
        } else if (fieldMap.containsKey('ibfsa__Start_Day__c')) {
            selectFields.add('ibfsa__Start_Day__c');
        }

        if (fieldMap.containsKey('End_Day__c')) {
            selectFields.add('End_Day__c');
        } else if (fieldMap.containsKey('ibfsa__End_Day__c')) {
            selectFields.add('ibfsa__End_Day__c');
        }

        String soql = 'SELECT ' + String.join(selectFields, ',') +
            ' FROM Beat__c WHERE Id IN :beatIds AND ibfsa__Active__c = true ORDER BY Name';
        return Database.query(soql);
    }

    /* =========================================================
    DAY TIMELINE – ALL VISITS
    ========================================================= */
    @AuraEnabled(cacheable=true)
    public static List<Visit__c> getDayTimeline(Date visitDate) {

        if (visitDate == null) {
            visitDate = Date.today();
        }

        return [
            SELECT
                Id,
                Name,
                ibfsa__Visit_Status__c,
                ibfsa__Planned_Start_Time__c,
                ibfsa__Planned_End_Time__c,
                ibfsa__Sequence__c,
                ibfsa__Visit_Date__c,
                ibfsa__Check_In_Time__c,
                ibfsa__Check_Out_Time__c,
                ibfsa__Actual_Duration__c,

                ibfsa__Outlet1__c,
                ibfsa__Outlet1__r.Name,
                ibfsa__Outlet1__r.ShippingAddress,
                ibfsa__Outlet1__r.ibfsa__Outlet_Location__Latitude__s,
                ibfsa__Outlet1__r.ibfsa__Outlet_Location__Longitude__s
                
            FROM Visit__c
            WHERE ibfsa__Sales_Rep__c = :UserInfo.getUserId()
            AND ibfsa__Visit_Date__c = :visitDate
            ORDER BY ibfsa__Planned_Start_Time__c ASC
        ];
    }

    /* =========================================================
       VISITS BY BEAT ( FIXED)
    ========================================================= */
    @AuraEnabled(cacheable=true)
    public static List<Visit__c> getVisitsByBeat(Id beatId, Date visitDate) {

        if (visitDate == null) {
            visitDate = Date.today();
        }

        return [
            SELECT
                Id,
                Name,
                ibfsa__Visit_Status__c,
                ibfsa__Planned_Start_Time__c,
                ibfsa__Planned_End_Time__c,
                ibfsa__Sequence__c,
                ibfsa__Check_In_Time__c,
                ibfsa__Check_Out_Time__c,
                ibfsa__Actual_Duration__c,

                /* OUTLET INFO */
                ibfsa__Outlet1__c,
                ibfsa__Outlet1__r.Name,
                ibfsa__Outlet1__r.ShippingAddress,
                ibfsa__Outlet1__r.ibfsa__Outlet_Location__Latitude__s,
                ibfsa__Outlet1__r.ibfsa__Outlet_Location__Longitude__s

                

            FROM Visit__c
            WHERE ibfsa__Sales_Rep__c = :UserInfo.getUserId()
            AND ibfsa__Visit_Date__c = :visitDate
            AND ibfsa__Beat__c = :beatId
            ORDER BY ibfsa__Sequence__c
        ];
    }

    /* =========================================================
       VISIT DETAIL (FOR DETAIL PAGE)
    ========================================================= */
    @AuraEnabled(cacheable=true)
    public static Visit__c getVisitDetail(Id visitId) {
        if (visitId == null) {
            return null;
        }

        return [
            SELECT
                Id,
                Name,
                ibfsa__Visit_Status__c,
                ibfsa__Planned_Start_Time__c,
                ibfsa__Planned_End_Time__c,
                ibfsa__Sequence__c,
               ibfsa__Check_In_Time__c,
               ibfsa__Check_Out_Time__c,
               ibfsa__Actual_Duration__c,

               ibfsa__Outlet1__c,
               ibfsa__Outlet1__r.Name,
               ibfsa__Outlet1__r.ShippingAddress,
               ibfsa__Outlet1__r.ibfsa__Outlet_Location__Latitude__s,
               ibfsa__Outlet1__r.ibfsa__Outlet_Location__Longitude__s
            FROM Visit__c
            WHERE Id = :visitId
            LIMIT 1
        ];
    }

    /* =========================================================
       OUTLET PHOTO (Account File)
    ========================================================= */
    @AuraEnabled(cacheable=true)
    public static ContentVersion getOutletPhoto(Id accountId) {
        if (accountId == null) {
            return null;
        }

        List<ContentDocumentLink> links = [
            SELECT ContentDocumentId, ContentDocument.LatestPublishedVersionId
            FROM ContentDocumentLink
            WHERE LinkedEntityId = :accountId
            ORDER BY ContentDocumentId DESC
            LIMIT 1
        ];

        if (links.isEmpty()) {
            return null;
        }

        Id versionId = links[0].ContentDocument.LatestPublishedVersionId;
        if (versionId == null) {
            return null;
        }

        List<ContentVersion> versions = [
            SELECT Id, Title, ContentDocumentId
            FROM ContentVersion
            WHERE Id = :versionId
            WITH USER_MODE
            LIMIT 1
        ];

        return versions.isEmpty() ? null : versions[0];
    }

    /* =========================================================
       CHECK IN VISIT
    ========================================================= */
    @AuraEnabled
    public static void checkInVisit(Id visitId, String lat, String lon) {

        if (visitId == null || String.isBlank(lat) || String.isBlank(lon)) {
            throw new AuraHandledException('Invalid check-in request.');
        }

        Id userId = UserInfo.getUserId();

        Day_Attendance__c att = [
            SELECT Id, End_Time__c
            FROM Day_Attendance__c
            WHERE Sales_Rep__c = :userId
            AND Attendance_Date__c = :Date.today()
            LIMIT 1
        ];

        if (att.End_Time__c != null) {
            throw new AuraHandledException('Please start your day first.');
        }

        Integer activeCount = [
            SELECT Count()
            FROM Visit__c
            WHERE ibfsa__Sales_Rep__c = :userId
            AND ibfsa__Visit_Status__c = 'In Progress'
        ];

        if (activeCount > 0) {
            throw new AuraHandledException('Another visit is already in progress.');
        }

        Visit__c v = [
            SELECT Id, ibfsa__Visit_Status__c
            FROM Visit__c
            WHERE Id = :visitId
            LIMIT 1
        ];

        if (v.ibfsa__Visit_Status__c != 'Approved') {
            throw new AuraHandledException('Visit not eligible for check-in.');
        }

        v.ibfsa__Visit_Status__c = 'In Progress';
        v.ibfsa__Check_In_Time__c = System.now();
        v.ibfsa__Check_In_Location__Latitude__s  = Decimal.valueOf(lat);
        v.ibfsa__Check_In_Location__Longitude__s = Decimal.valueOf(lon);

        update v;

        try {
            TravelDistanceService.logPoint(
                att.Id,
                v.Id,
                'CHECK_IN',
                Decimal.valueOf(lat),
                Decimal.valueOf(lon),
                v.ibfsa__Check_In_Time__c
            );
            TravelDistanceService.recalculateAttendanceDistance(att.Id);
        } catch (Exception ex) {
        }
    }

    /* =========================================================
       CHECK OUT VISIT
    ========================================================= */
    @AuraEnabled
    public static void checkOutVisit(Id visitId, String lat, String lon) {

        if (visitId == null || String.isBlank(lat) || String.isBlank(lon)) {
            throw new AuraHandledException('Invalid check-out request.');
        }

        Visit__c v = [
            SELECT Id, ibfsa__Visit_Status__c
            FROM Visit__c
            WHERE Id = :visitId
            LIMIT 1
        ];

        if (v.ibfsa__Visit_Status__c != 'In Progress') {
            throw new AuraHandledException('Visit not checked in.');
        }

        v.ibfsa__Visit_Status__c = 'Completed';
        v.ibfsa__Check_Out_Time__c = System.now();
        v.ibfsa__Check_Out_Location__Latitude__s  = Decimal.valueOf(lat);
        v.ibfsa__Check_Out_Location__Longitude__s = Decimal.valueOf(lon);

        update v;

        try {
            Id attendanceId = getTodayAttendanceId();
            if (attendanceId != null) {
                TravelDistanceService.logPoint(
                    attendanceId,
                    v.Id,
                    'CHECK_OUT',
                    Decimal.valueOf(lat),
                    Decimal.valueOf(lon),
                    v.ibfsa__Check_Out_Time__c
                );
                TravelDistanceService.recalculateAttendanceDistance(attendanceId);
            }
        } catch (Exception ex) {
        }
    }

    /* =========================================================
       END DAY
    ========================================================= */
    @AuraEnabled
    public static void endDay(String lat, String lon) {

        if (String.isBlank(lat) || String.isBlank(lon)) {
            throw new AuraHandledException('Location permission is required.');
        }

        List<Day_Attendance__c> listAtt = [
            SELECT Id, End_Time__c
            FROM Day_Attendance__c
            WHERE Sales_Rep__c = :UserInfo.getUserId()
            AND Attendance_Date__c = :Date.today()
            LIMIT 1
        ];

        if (listAtt.isEmpty()) {
            throw new AuraHandledException('Please start your day first.');
        }

        Day_Attendance__c att = listAtt[0];

        if (att.End_Time__c != null) {
            throw new AuraHandledException('Day already ended.');
        }

        att.End_Time__c = System.now();
        att.End_Location__Latitude__s  = Decimal.valueOf(lat);
        att.End_Location__Longitude__s = Decimal.valueOf(lon);

        update att;

        try {
            TravelDistanceService.logPoint(
                att.Id,
                null,
                'END_DAY',
                Decimal.valueOf(lat),
                Decimal.valueOf(lon),
                att.End_Time__c
            );
            TravelDistanceService.recalculateAttendanceDistance(att.Id);
            TravelDistanceService.createOrUpdateClaim(att.Id);
        } catch (Exception ex) {
        }
    }

  /* =========================================================
       Upload Photo
    ========================================================= */
    /**
     * Uploads a photo as ContentVersion and links it to the provided Visit__c record.
     * Runs in user mode to honor FLS and sharing. Validates inputs and handles errors.
     *
     * @param visitId     Id of the Visit__c record
     * @param base64Data  Base64-encoded file body (no data URL prefix)
     * @param contentType MIME type (e.g., image/jpeg, image/png)
     * @return Id of the created ContentVersion
     * @throws AuraHandledException with a safe message if validation or DML fails
     */
    @AuraEnabled
    public static Id uploadVisitPhoto(Id visitId, String base64Data, String contentType) {
        String fileName;
        // Return Early validations
        if (visitId == null) {
            throw new AuraHandledException('Visit Id is required.');
        }
        if (String.isBlank(base64Data)) {
            throw new AuraHandledException('Image data is required.');
        }
        if (String.isBlank(contentType)) {
            contentType = 'image/jpeg';
        }

        // Ensure Visit exists and is accessible to the running user
        Visit__c v = [
            SELECT Id, Name
            FROM Visit__c
            WHERE Id = :visitId
            WITH USER_MODE
            LIMIT 1
        ];

        fileName = 'Visit_Photo_' + v.Name + '.jpg';

        // Decode Base64 into Blob
        Blob body;
        try {
            body = EncodingUtil.base64Decode(base64Data);
        } catch (Exception e) {
            throw new AuraHandledException('Invalid image data. Please try again.');
        }

        // Create ContentVersion in USER_MODE so sharing/FLS are respected
        ContentVersion cv = new ContentVersion();
        cv.Title = fileName;
        cv.PathOnClient = fileName;
        cv.VersionData = body;
        cv.IsMajorVersion = true;
        cv.Origin = 'H'; // marks as uploaded from UI
        cv.SharingPrivacy = 'N'; // normal

        Database.SaveResult cvSr = Database.insert(cv, AccessLevel.USER_MODE);
        if (!cvSr.isSuccess()) {
            throw new AuraHandledException(extractError(cvSr));
        }

        // Query back the created ContentDocumentId from the new ContentVersion
        ContentVersion created = [
            SELECT Id, ContentDocumentId
            FROM ContentVersion
            WHERE Id = :cvSr.getId()
            LIMIT 1
        ];

        // Link the ContentDocument to the Visit__c via ContentDocumentLink
        ContentDocumentLink cdl = new ContentDocumentLink();
        cdl.LinkedEntityId = v.Id;
        cdl.ContentDocumentId = created.ContentDocumentId;
        cdl.ShareType = 'V'; // View permission
        cdl.Visibility = 'AllUsers';

        Database.SaveResult cdlSr = Database.insert(cdl, AccessLevel.USER_MODE);
        if (!cdlSr.isSuccess()) {
            // Attempt cleanup if linking failed
            try {
                Database.delete(created.ContentDocumentId, AccessLevel.USER_MODE);
            } catch (Exception ex) {
                // swallow cleanup error, report original
            }
            throw new AuraHandledException(extractError(cdlSr));
        }

        return created.Id;
    }

    // Helper to extract a user-friendly DML error
    private static String extractError(Database.SaveResult sr) {
        if (sr == null || sr.isSuccess()) return 'Unknown error';
        if (sr.getErrors() != null && sr.getErrors().size() > 0) {
            return sr.getErrors()[0].getMessage();
        }
        return 'Unknown error';
    }

    /* =========================================================
       Get Visit Photo
    ========================================================= */
    @AuraEnabled(cacheable=true)
    public static ContentVersion getVisitPhoto(Id visitId) {
        if (visitId == null) {
            return null;
        }

        // Get the Content Document Link record based on visit Id
        List<ContentDocumentLink> cdls = [
            SELECT Id, LinkedEntity.Name, ContentDocumentId, ContentDocument.Title
            FROM ContentDocumentLink 
            WHERE LinkedEntityId  = :visitId
            WITH USER_MODE
            LIMIT 1
        ];

        if (cdls.isEmpty()) {
            return null;
        }

        // Construct the expected title
        String expectedTitle = 'Visit_Photo_' + cdls[0].LinkedEntity.Name + '.jpg';

        // Find the ContentVersion with that title linked to this visit
        List<ContentVersion> contentVersions = [
            SELECT Id, ContentDocumentId, Title, PathOnClient
            FROM ContentVersion
            WHERE Title = :expectedTitle AND ContentDocumentId = :cdls[0].ContentDocumentId
            WITH USER_MODE
            LIMIT 1
        ];

        if (contentVersions.isEmpty()) {
            return null;
        }

        return contentVersions[0];
    }

    /* =========================================================
       Delete Visit Photo
    ========================================================= */
    @AuraEnabled
    public static void deleteVisitPhoto(Id contentVersionId) {

        ContentVersion cv = [
            SELECT Id, ContentDocumentId, Title
            FROM ContentVersion
            WHERE Id = :contentVersionId
            WITH USER_MODE
            LIMIT 1
        ];

        Database.DeleteResult deleteDocResult = Database.delete(cv.ContentDocumentId, AccessLevel.USER_MODE);
        if (!deleteDocResult.isSuccess()) {
            throw new AuraHandledException('Failed to delete document: ' + deleteDocResult.getErrors()[0].getMessage());
        }
    }

    private static Id getTodayAttendanceId() {
        List<Day_Attendance__c> listAtt = [
            SELECT Id
            FROM Day_Attendance__c
            WHERE Sales_Rep__c = :UserInfo.getUserId()
            AND Attendance_Date__c = :Date.today()
            LIMIT 1
        ];
        return listAtt.isEmpty() ? null : listAtt[0].Id;
    }
}