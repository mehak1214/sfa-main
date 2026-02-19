public with sharing class CreateSampleRecords {
    
    public static void createSampleRecords() {
        // Step 1: Create ibfsa__Sales_Target__c record
        ibfsa__Sales_Target__c salesTarget = new ibfsa__Sales_Target__c(
            Name = 'Sample Sales Target',
            ibfsa__Month_Year__c = Date.newInstance(2026, 2, 1),
            ibfsa__Sales_Rep__c = '005f6000003kelVAAQ', // Valid User ID from query
            ibfsa__Target_Amount__c = 75000,
            ibfsa__Target_Type__c = 'Revenue'
        );
        
        insert salesTarget;
        
        // Step 2: Create ibfsa__Monthly_Performance__c record
        ibfsa__Monthly_Performance__c monthlyPerformance = new ibfsa__Monthly_Performance__c(
            Name = 'Sample Monthly Performance',
            ibfsa__Month_Year__c = Date.newInstance(2026, 2, 1),
            ibfsa__Sales_Rep__c = '005f6000003kelVAAQ',
            ibfsa__Sales_Target__c = salesTarget.Id,
            ibfsa__Actual_Sales__c = 65000,
            ibfsa__Planned_Visits__c = 10,
            ibfsa__Completed_Visits__c = 8,
            ibfsa__Weight_Achievement__c = 60,
            ibfsa__Weight_Visits__c = 40
        );
        
        insert monthlyPerformance;
        
        // Step 3: Create ibfsa__Incentive__c record
        ibfsa__Incentive__c incentive = new ibfsa__Incentive__c(
            Name = 'Sample Incentive',
            ibfsa__Sales_Rep__c = '005f6000003kelVAAQ',
            ibfsa__Monthly_Performance__c = monthlyPerformance.Id,
            ibfsa__Incentive_Amount__c = 5000,
            ibfsa__Month_Year__c = false // Checkbox field
        );
        
        insert incentive;
    }
}