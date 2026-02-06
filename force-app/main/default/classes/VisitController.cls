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

                ibfsa__Outlet__r.Name,
                ibfsa__Outlet__r.ibfsa__Addresss__c,
                ibfsa__Outlet__r.ibfsa__Outlet_Location__Latitude__s,
                ibfsa__Outlet__r.ibfsa__Outlet_Location__Longitude__s
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

                /* OUTLET INFO */
                ibfsa__Outlet__r.Name,
                ibfsa__Outlet__r.ibfsa__Addresss__c,

                /* GEOLOCATION (ONLY THIS) */
                ibfsa__Outlet__r.ibfsa__Outlet_Location__Latitude__s,
                ibfsa__Outlet__r.ibfsa__Outlet_Location__Longitude__s

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

                ibfsa__Outlet__r.Name,
                ibfsa__Outlet__r.ibfsa__Addresss__c,
                ibfsa__Outlet__r.ibfsa__Outlet_Location__Latitude__s,
                ibfsa__Outlet__r.ibfsa__Outlet_Location__Longitude__s
            FROM Visit__c
            WHERE Id = :visitId
            LIMIT 1
        ];
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
    }
}