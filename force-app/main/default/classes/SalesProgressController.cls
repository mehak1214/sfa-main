public with sharing class SalesProgressController {

    @AuraEnabled(cacheable=true)
    public static Map<String, Decimal> getSalesProgress(Id userId, Date monthDate) {
        
        // Initialize result map
        Map<String, Decimal> result = new Map<String, Decimal>{
            'actual' => 0,
            'target' => 0,
            'progress' => 0
        };

        try {
            System.debug('===== SALES PROGRESS METHOD START =====');
            System.debug('Input UserId: ' + userId);
            System.debug('Input MonthDate: ' + monthDate);

            // Validate inputs
            if(userId == null || String.valueOf(userId).trim() == ''){
                System.debug('UserId is null or empty. Returning default values.');
                return result;
            }
            
            if(monthDate == null){
                System.debug('MonthDate is null. Returning default values.');
                return result;
            }

            // Extract year and month
            Integer monthVal = monthDate.month();
            Integer yearVal = monthDate.year();

            System.debug('Extracted Month: ' + monthVal);
            System.debug('Extracted Year: ' + yearVal);

            // ---- SALES TARGET QUERY ----
            List<ibfsa__Sales_Target__c> targets = [
                SELECT Id,
                       ibfsa__Target_Amount__c,
                       ibfsa__Month_Year__c,
                       ibfsa__Sales_Rep__c
                FROM ibfsa__Sales_Target__c
                WHERE ibfsa__Sales_Rep__c = :userId
                AND CALENDAR_YEAR(ibfsa__Month_Year__c) = :yearVal
                AND CALENDAR_MONTH(ibfsa__Month_Year__c) = :monthVal
                LIMIT 1
            ];

            System.debug('Targets Found: ' + targets.size());

            // ---- PERFORMANCE QUERY ----
            List<ibfsa__Monthly_Performance__c> perfs = [
                SELECT Id,
                       ibfsa__Actual_Sales__c,
                       ibfsa__Month_Year__c,
                       ibfsa__Sales_Rep__c
                FROM ibfsa__Monthly_Performance__c
                WHERE ibfsa__Sales_Rep__c = :userId
                AND CALENDAR_YEAR(ibfsa__Month_Year__c) = :yearVal
                AND CALENDAR_MONTH(ibfsa__Month_Year__c) = :monthVal
                LIMIT 1
            ];

            System.debug('Performance Records Found: ' + perfs.size());

            Decimal targetAmt = targets.isEmpty() ? 0 : targets[0].ibfsa__Target_Amount__c;
            Decimal actualAmt = perfs.isEmpty() ? 0 : perfs[0].ibfsa__Actual_Sales__c;

            System.debug('Target Amount: ' + targetAmt);
            System.debug('Actual Amount: ' + actualAmt);

            Decimal progress = 0;

            if (targetAmt != null && targetAmt > 0) {
                progress = (actualAmt / targetAmt) * 100;
            }

            System.debug('Calculated Progress: ' + progress);

            result.put('actual', actualAmt);
            result.put('target', targetAmt);
            result.put('progress', progress.setScale(1));

            System.debug('Final Result Map: ' + result);
            System.debug('===== SALES PROGRESS METHOD END =====');

        } catch(Exception e) {
            System.debug('Exception in getSalesProgress: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
        }

        return result;
    }
}