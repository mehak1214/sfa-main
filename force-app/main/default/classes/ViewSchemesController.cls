public with sharing class ViewSchemesController {

    /* =========================================================
       SCHEME WRAPPER FOR DISPLAY
       ========================================================= */
    public class SchemeWrapper {
        @AuraEnabled public Id schemeId;
        @AuraEnabled public String schemeName;
        @AuraEnabled public Boolean isActive;
        @AuraEnabled public Decimal discount;
        @AuraEnabled public Decimal thresholdQuantity;
        @AuraEnabled public Date startDate;
        @AuraEnabled public Date endDate;
        @AuraEnabled public String description;

        public SchemeWrapper(ibfsa__Scheme__c scheme) {
            this.schemeId = scheme.Id;
            this.schemeName = scheme.ibfsa__Scheme_Name__c;
            this.isActive = scheme.ibfsa__Active__c;
            this.discount = scheme.ibfsa__Discount__c;
            this.thresholdQuantity = scheme.ibfsa__Threshold_Quantity__c;
            this.startDate = scheme.ibfsa__Start_Date__c;
            this.endDate = scheme.ibfsa__End_Date__c;
            this.description =scheme.ibfsa__Description__c;
        }
    }

    /* =========================================================
       FETCH ALL SCHEMES SORTED BY ACTIVE STATUS
       ========================================================= */
    @AuraEnabled(cacheable=true)
    public static List<SchemeWrapper> getAllSchemes() {
        System.debug('getAllSchemes() called');
        
        List<SchemeWrapper> schemeWrappers = new List<SchemeWrapper>();
        
        try {
            List<ibfsa__Scheme__c> schemes = [
                SELECT Id, Name, ibfsa__Active__c,ibfsa__scheme_name__c, ibfsa__Discount__c,ibfsa__Description__c, 
                       ibfsa__Threshold_Quantity__c, ibfsa__Start_Date__c, ibfsa__End_Date__c
                FROM ibfsa__Scheme__c
                ORDER BY ibfsa__Active__c DESC NULLS LAST, Name ASC
            ];
            
            for (ibfsa__Scheme__c scheme : schemes) {
                schemeWrappers.add(new SchemeWrapper(scheme));
            }
            
            System.debug('getAllSchemes() returned ' + schemeWrappers.size() + ' schemes');
        } catch (Exception e) {
            System.debug('ERROR in getAllSchemes(): ' + e.getMessage());
            throw new AuraHandledException('Error fetching schemes: ' + e.getMessage());
        }
        
        return schemeWrappers;
    }
}