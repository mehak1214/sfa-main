public with sharing class BeatPlanController {

    // ─────────────────────────────────────────────────────────────────────────
    // INNER CLASSES
    // ─────────────────────────────────────────────────────────────────────────

    /** One visit card on the weekly calendar grid */
    public class VisitWrapper {
        @AuraEnabled public String  id                 { get; set; }
        @AuraEnabled public String  name               { get; set; }
        @AuraEnabled public String  beatId             { get; set; }  // ibfsa__Beat__c
        @AuraEnabled public String  beatName           { get; set; }  // ibfsa__Beat__r.Name
        @AuraEnabled public String  outletId           { get; set; }  // ibfsa__Outlet1__c
        @AuraEnabled public String  outletName         { get; set; }  // ibfsa__Outlet1__r.Name
        @AuraEnabled public String  outletPriority     { get; set; }  // ibfsa__Outlet1__r.ibfsa__Outlet_Priority__c
        @AuraEnabled public String  visitStatus        { get; set; }  // ibfsa__Visit_Status__c
        @AuraEnabled public String  approvalStatus     { get; set; }  // ibfsa__Approval_Status__c
        @AuraEnabled public Boolean isCompleted        { get; set; }  // ibfsa__Is_Completed__c
        @AuraEnabled public String  missedReason       { get; set; }  // ibfsa__Missed_Reason__c
        @AuraEnabled public String  missedRemarks      { get; set; }  // ibfsa__Missed_Remarks__c
        @AuraEnabled public Date    visitDate          { get; set; }  // ibfsa__Visit_Date__c
        @AuraEnabled public String  plannedStartTime   { get; set; }  // formatted ibfsa__Planned_Start_Time__c
        @AuraEnabled public String  plannedEndTime     { get; set; }  // formatted ibfsa__Planned_End_Time__c
        @AuraEnabled public String  checkInTime        { get; set; }  // formatted ibfsa__Check_In_Time__c
        @AuraEnabled public String  checkOutTime       { get; set; }  // formatted ibfsa__Check_Out_Time__c
        @AuraEnabled public Integer sequence           { get; set; }  // ibfsa__Sequence__c
        @AuraEnabled public String  dayOfWeek          { get; set; }  // derived: MON-SUN
        @AuraEnabled public String  colorClass         { get; set; }  // derived from visitStatus
    }

    /** Header stats shown in the banner bar */
    public class WeekStats {
        @AuraEnabled public Integer totalVisits    { get; set; }
        @AuraEnabled public Integer completed      { get; set; }
        @AuraEnabled public Integer pending        { get; set; }
        @AuraEnabled public Integer missed         { get; set; }
        @AuraEnabled public String  weekLabel      { get; set; }
        @AuraEnabled public String  beatId         { get; set; }
        @AuraEnabled public String  beatName       { get; set; }
        @AuraEnabled public String  beatStatus     { get; set; }  // ibfsa__Status__c on Beat
        @AuraEnabled public Date    beatStartDate  { get; set; }
        @AuraEnabled public Date    beatEndDate    { get; set; }
    }

    /** Root object returned by getWeeklyVisits — consumed by LWC */
    public class WeekData {
        @AuraEnabled public WeekStats          stats  { get; set; }
        @AuraEnabled public List<VisitWrapper> visits { get; set; }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PUBLIC METHODS
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * getWeeklyVisits
     * Loads all ibfsa__Visit__c records for the week containing anchorDate.
     *
     * Flow:
     *   1. Find ibfsa__Beat__c where the rep is assigned and week overlaps.
     *   2. Query ibfsa__Visit__c children of that Beat for the date range,
     *      crossing to ibfsa__Outlet1__r (Account) for outlet details.
     *   3. Return WeekData (stats + visit list).
     *
     * @param anchorDate  Any date within the target week. Null = today.
     */
    @AuraEnabled(cacheable=true)
    public static WeekData getWeeklyVisits(Date anchorDate) {
        Date weekStart = mondayOf(anchorDate != null ? anchorDate : Date.today());
        Date weekEnd   = weekStart.addDays(6);

        // ── Step 1: Find the active Beat for this rep that covers this week ──
        List<ibfsa__Beat__c> beats = [
            SELECT  Id,
                    Name,
                    ibfsa__Status__c,
                    ibfsa__Active__c,
                    ibfsa__Start_Date__c,
                    ibfsa__End_Date__c,
                    ibfsa__Sales_Rep__c
            FROM    ibfsa__Beat__c
            WHERE   ibfsa__Sales_Rep__c = :UserInfo.getUserId()
            AND     ibfsa__Active__c    = true
            AND     ibfsa__Start_Date__c <= :weekEnd
            AND     ibfsa__End_Date__c   >= :weekStart
            ORDER BY ibfsa__Start_Date__c DESC
            LIMIT   1
        ];

        // ── Step 2: Query Visits for that Beat in this week's date range ─────
        // ibfsa__Visit__c.ibfsa__Beat__c    = parent Beat
        // ibfsa__Visit__c.ibfsa__Outlet1__c = Account (outlet/store)
        List<ibfsa__Visit__c> records = new List<ibfsa__Visit__c>();

        if (!beats.isEmpty()) {
            records = [
                SELECT  Id,
                        Name,
                        ibfsa__Beat__c,
                        ibfsa__Beat__r.Name,
                        ibfsa__Outlet1__c,
                        ibfsa__Outlet1__r.Name,
                        ibfsa__Outlet1__r.ibfsa__Outlet_Priority__c,
                        ibfsa__Sales_Rep__c,
                        ibfsa__Visit_Date__c,
                        ibfsa__Planned_Start_Time__c,
                        ibfsa__Planned_End_Time__c,
                        ibfsa__Check_In_Time__c,
                        ibfsa__Check_Out_Time__c,
                        ibfsa__Visit_Status__c,
                        ibfsa__Approval_Status__c,
                        ibfsa__Is_Completed__c,
                        ibfsa__Missed_Reason__c,
                        ibfsa__Missed_Remarks__c,
                        ibfsa__Sequence__c
                FROM    ibfsa__Visit__c
                WHERE   ibfsa__Beat__c       = :beats[0].Id
                AND     ibfsa__Visit_Date__c >= :weekStart
                AND     ibfsa__Visit_Date__c <= :weekEnd
                ORDER BY ibfsa__Visit_Date__c ASC,
                         ibfsa__Sequence__c   ASC NULLS LAST,
                         ibfsa__Planned_Start_Time__c ASC NULLS LAST
                LIMIT   200
            ];
        }

        // ── Step 3: Build stats ───────────────────────────────────────────────
        WeekStats stats     = new WeekStats();
        stats.totalVisits   = records.size();
        stats.completed     = 0;
        stats.pending       = 0;
        stats.missed        = 0;
        stats.weekLabel     = weekRangeLabel(weekStart, weekEnd);
        stats.beatId        = beats.isEmpty() ? null  : beats[0].Id;
        stats.beatName      = beats.isEmpty() ? null  : beats[0].Name;
        stats.beatStatus    = beats.isEmpty() ? null  : beats[0].ibfsa__Status__c;
        stats.beatStartDate = beats.isEmpty() ? null  : beats[0].ibfsa__Start_Date__c;
        stats.beatEndDate   = beats.isEmpty() ? null  : beats[0].ibfsa__End_Date__c;

        // ── Step 4: Map records → VisitWrappers ───────────────────────────────
        List<VisitWrapper> visits = new List<VisitWrapper>();

        for (ibfsa__Visit__c r : records) {
            VisitWrapper v      = new VisitWrapper();
            v.id                = r.Id;
            v.name              = r.Name;
            v.beatId            = r.ibfsa__Beat__c;
            v.beatName          = r.ibfsa__Beat__r.Name;
            v.outletId          = r.ibfsa__Outlet1__c;
            v.outletName        = r.ibfsa__Outlet1__r != null ? r.ibfsa__Outlet1__r.Name : '—';
            v.outletPriority    = r.ibfsa__Outlet1__r != null ? r.ibfsa__Outlet1__r.ibfsa__Outlet_Priority__c : null;
            v.visitStatus       = r.ibfsa__Visit_Status__c;
            v.approvalStatus    = r.ibfsa__Approval_Status__c;
            v.isCompleted       = r.ibfsa__Is_Completed__c;
            v.missedReason      = r.ibfsa__Missed_Reason__c;
            v.missedRemarks     = r.ibfsa__Missed_Remarks__c;
            v.visitDate         = r.ibfsa__Visit_Date__c;
            v.plannedStartTime  = fmtDateTime(r.ibfsa__Planned_Start_Time__c);
            v.plannedEndTime    = fmtDateTime(r.ibfsa__Planned_End_Time__c);
            v.checkInTime       = fmtDateTime(r.ibfsa__Check_In_Time__c);
            v.checkOutTime      = fmtDateTime(r.ibfsa__Check_Out_Time__c);
            v.sequence          = r.ibfsa__Sequence__c != null ? Integer.valueOf(r.ibfsa__Sequence__c) : null;
            v.dayOfWeek         = dayLabel(r.ibfsa__Visit_Date__c);
            v.colorClass        = statusToColor(r.ibfsa__Visit_Status__c, r.ibfsa__Is_Completed__c);

            String s = r.ibfsa__Visit_Status__c;
            if      (r.ibfsa__Is_Completed__c == true) stats.completed++;
            else if (s == 'Missed')                    stats.missed++;
            else                                       stats.pending++;

            visits.add(v);
        }

        WeekData data  = new WeekData();
        data.stats     = stats;
        data.visits    = visits;
        return data;
    }

    /**
     * submitBeatPlan
     * Transitions ibfsa__Beat__c.ibfsa__Status__c → 'Submitted'
     * and bulk-updates all Planned visits under it to 'Pending Approval'.
     *
     * @param beatId  Id of ibfsa__Beat__c to submit.
     */
    @AuraEnabled
    public static String submitBeatPlan(String beatId) {
        if (String.isBlank(beatId)) {
            throw new AuraHandledException('Beat ID is required to submit.');
        }

        ibfsa__Beat__c beat = [
            SELECT  Id, ibfsa__Status__c, OwnerId
            FROM    ibfsa__Beat__c
            WHERE   Id      = :beatId
            AND     OwnerId = :UserInfo.getUserId()
            LIMIT   1
        ];

        beat.ibfsa__Status__c = 'Submitted';
        update beat;

        // Bulk-update visits under this Beat that are still in Planned state
        List<ibfsa__Visit__c> toUpdate = [
            SELECT  Id, ibfsa__Approval_Status__c
            FROM    ibfsa__Visit__c
            WHERE   ibfsa__Beat__c            = :beatId
            AND     ibfsa__Approval_Status__c = 'Planned'
        ];

        for (ibfsa__Visit__c v : toUpdate) {
            v.ibfsa__Approval_Status__c = 'Pending Approval';
        }

        if (!toUpdate.isEmpty()) update toUpdate;

        return 'SUCCESS';
    }

    /**
     * saveVisit
     * Upserts a single ibfsa__Visit__c.
     * Requires beatId (ibfsa__Beat__c) AND outletId (ibfsa__Outlet1__c).
     * Beat is NOT linked to Account directly — both lookups live on the Visit.
     *
     * @param visitJson  JSON of VisitWrapper.
     */
    @AuraEnabled
    public static String saveVisit(String visitJson) {
        VisitWrapper v = (VisitWrapper) JSON.deserialize(visitJson, VisitWrapper.class);

        ibfsa__Visit__c record = new ibfsa__Visit__c();

        if (String.isNotBlank(v.id)) {
            record.Id = v.id;
        }

        // Both lookups are on the Visit record
        record.ibfsa__Beat__c    = v.beatId;      // parent Beat
        record.ibfsa__Outlet1__c = v.outletId;    // Account (outlet)

        if (v.visitDate    != null) record.ibfsa__Visit_Date__c    = v.visitDate;
        if (v.sequence     != null) record.ibfsa__Sequence__c      = v.sequence;

        record.ibfsa__Visit_Status__c     = String.isBlank(v.visitStatus) ? 'Planned' : v.visitStatus;
        record.ibfsa__Approval_Status__c  = String.isBlank(v.approvalStatus) ? 'Planned' : v.approvalStatus;

        upsert record;
        return record.Id;
    }

    /**
     * getBeatForWeek
     * Returns the active ibfsa__Beat__c Id for the current user and
     * week containing anchorDate. Used by LWC before opening "Add Visit".
     *
     * @param anchorDate  Any date within the target week.
     */
    @AuraEnabled(cacheable=false)
    public static String getBeatForWeek(Date anchorDate) {
        Date weekStart = mondayOf(anchorDate != null ? anchorDate : Date.today());
        Date weekEnd   = weekStart.addDays(6);

        List<ibfsa__Beat__c> beats = [
            SELECT  Id
            FROM    ibfsa__Beat__c
            WHERE   ibfsa__Sales_Rep__c  = :UserInfo.getUserId()
            AND     ibfsa__Active__c     = true
            AND     ibfsa__Start_Date__c <= :weekEnd
            AND     ibfsa__End_Date__c   >= :weekStart
            ORDER BY ibfsa__Start_Date__c DESC
            LIMIT   1
        ];

        return beats.isEmpty() ? null : beats[0].Id;
    }

    /**
     * getOutletsForBeat
     * Returns all Accounts assigned to a given ibfsa__Beat__c.
     * Account.ibfsa__Beat__c is the direct lookup on Account.
     *
     * @param beatId  Id of ibfsa__Beat__c.
     */
    @AuraEnabled(cacheable=true)
    public static List<Account> getOutletsForBeat(String beatId) {
        if (String.isBlank(beatId)) return new List<Account>();

        return [
            SELECT  Id,
                    Name,
                    ibfsa__OutletStatus__c,
                    ibfsa__Outlet_Priority__c,
                    ibfsa__Visit_Frequency__c,
                    ibfsa__Outlet_Code__c,
                    Phone
            FROM    Account
            WHERE   ibfsa__Beat__c = :beatId
            ORDER BY Name ASC
            LIMIT   200
        ];
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PRIVATE HELPERS
    // ─────────────────────────────────────────────────────────────────────────

    /** Monday of the week containing d (Salesforce toStartOfWeek = Sunday, +1 day) */
    private static Date mondayOf(Date d) {
        return d.toStartOfWeek().addDays(1);
    }

    /** "Feb 11 – Feb 17" */
    private static String weekRangeLabel(Date s, Date e) {
    String startLabel = Datetime.newInstance(s, Time.newInstance(0,0,0,0)).format('MMM d');
	String endLabel   = Datetime.newInstance(e, Time.newInstance(0,0,0,0)).format('MMM d');
	return startLabel + ' – ' + endLabel;
}

    /**
     * Day-of-week label from a Date.
     * format('u') returns 1=MON … 7=SUN in Apex.
     */
    private static String dayLabel(Date d) {
        if (d == null) return 'MON';
        DateTime dt = DateTime.newInstance(d, Time.newInstance(0,0,0,0));
        Integer  u  = Integer.valueOf(dt.format('u'));
        String[] lbl = new String[]{'', 'MON','TUE','WED','THU','FRI','SAT','SUN'};
        return (u >= 1 && u <= 7) ? lbl[u] : 'MON';
    }

    /** Formats a DateTime field to "10:00 AM". Returns '' for null. */
    private static String fmtDateTime(DateTime dt) {
        if (dt == null) return '';
        return dt.format('h:mm a');
    }

    /**
     * Maps ibfsa__Visit_Status__c → CSS color class for LWC card.
     * Completed    → card-completed  (green)
     * Missed       → card-missed     (red)
     * In Progress  → card-inprogress (blue)
     * Planned      → card-planned    (purple)
     */
    private static String statusToColor(String status, Boolean isCompleted) {
        if (isCompleted == true)       return 'card-completed';
        if (status == 'Missed')        return 'card-missed';
        if (status == 'In Progress')   return 'card-inprogress';
        return 'card-planned';
    }
}