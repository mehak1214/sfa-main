public with sharing class ActiveSchemesCardViewController {
    
    /**
     * Wrapper class to hold scheme data
     */
    public class SchemeWrapper {
        @AuraEnabled
        public String Id { get; set; }
        @AuraEnabled
        public String SchemeName { get; set; }
        @AuraEnabled
        public Date StartDate { get; set; }
        @AuraEnabled
        public Date EndDate { get; set; }
        @AuraEnabled
        public Decimal Discount { get; set; }
        @AuraEnabled
        public String Description { get; set; }
    }

    /**
     * Fetch active Scheme records from ibfsa__Scheme__c object
     */
    @AuraEnabled(cacheable=true)
    public static List<SchemeWrapper> getActiveSchemes() {
        try {
            List<SchemeWrapper> schemes = new List<SchemeWrapper>();
            
            // Query all active schemes
            List<ibfsa__Scheme__c> schemeList = [
                SELECT Id, ibfsa__Scheme_Name__c, ibfsa__Start_Date__c, ibfsa__End_Date__c, ibfsa__Discount__c, ibfsa__Description__c
                FROM ibfsa__Scheme__c
                WHERE ibfsa__Active__c = true
                ORDER BY CreatedDate DESC
                LIMIT 100
            ];
            
            // Create wrappers
            for (ibfsa__Scheme__c scheme : schemeList) {
                SchemeWrapper wrapper = new SchemeWrapper();
                wrapper.Id = scheme.Id;
                wrapper.SchemeName = scheme.ibfsa__Scheme_Name__c;
                wrapper.StartDate = scheme.ibfsa__Start_Date__c;
                wrapper.EndDate = scheme.ibfsa__End_Date__c;
                wrapper.Discount = scheme.ibfsa__Discount__c;
                wrapper.Description = scheme.ibfsa__Description__c;
                
                schemes.add(wrapper);
            }
            
            return schemes;
        } catch (Exception e) {
            throw new AuraHandledException('Error retrieving active schemes: ' + e.getMessage());
        }
    }
}