public without sharing class SchemesController {

    /* =========================================================
       SCHEME WRAPPER CLASS
       ========================================================= */
    public class SchemeWrapper {
        @AuraEnabled public Id schemeId;
        @AuraEnabled public String schemeName;
        @AuraEnabled public Decimal schemeValue;
        @AuraEnabled public String description;
        @AuraEnabled public Decimal thresholdQuantity;
        @AuraEnabled public Date startDate;
        @AuraEnabled public Date endDate;
        @AuraEnabled public Boolean isActive;
        @AuraEnabled public String color;
        @AuraEnabled public String tileStyle;
        @AuraEnabled public String detailStyle;

        public SchemeWrapper() {}

        public SchemeWrapper(ibfsa__Scheme__c scheme, String schemeColor) {
            this.schemeId = scheme.Id;
            this.schemeName = scheme.ibfsa__Scheme_Name__c;
            this.schemeValue = scheme.ibfsa__Discount__c != null ? scheme.ibfsa__Discount__c : 0;
            this.description = scheme.ibfsa__Description__c;
            this.thresholdQuantity = scheme.ibfsa__Threshold_Quantity__c;
            this.startDate = scheme.ibfsa__Start_Date__c;
            this.endDate = scheme.ibfsa__End_Date__c;
            this.isActive = scheme.ibfsa__Active__c;
            this.color = schemeColor;
            this.tileStyle = 'background-color: ' + schemeColor + ';';
            this.detailStyle = 'background-color: ' + schemeColor + ';';
        }
    }

    /* =========================================================
       GET ALL SCHEMES
       ========================================================= */
    @AuraEnabled(cacheable=false)
    public static List<SchemeWrapper> getAllSchemes() {
        List<SchemeWrapper> schemeWrappers = new List<SchemeWrapper>();
        List<String> colors = new List<String>{
            '#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0', '#00BCD4'
        };

        try {
            System.debug('=== Starting getAllSchemes ===');
            List<ibfsa__Scheme__c> schemes = [
                SELECT 
                    Id,
                    ibfsa__Scheme_Name__c,
                    ibfsa__Discount__c,
                    ibfsa__Description__c,
                    ibfsa__Threshold_Quantity__c,
                    ibfsa__Start_Date__c,
                    ibfsa__End_Date__c,
                    ibfsa__Active__c
                FROM ibfsa__Scheme__c
                ORDER BY ibfsa__Discount__c DESC
                LIMIT 100
            ];
            
            System.debug('Schemes retrieved: ' + schemes.size());

            Integer colorIndex = 0;
            for (ibfsa__Scheme__c scheme : schemes) {
                String color = colors.get(Math.mod(colorIndex, colors.size()));
                schemeWrappers.add(new SchemeWrapper(scheme, color));
                colorIndex++;
            }
            
            System.debug('Wrapped schemes: ' + schemeWrappers.size());
        } catch (Exception e) {
            System.debug('Error fetching schemes: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
            throw new AuraHandledException('Unable to fetch schemes: ' + e.getMessage());
        }

        return schemeWrappers;
    }

    /* =========================================================
       GET FIRST 3 SCHEMES
       ========================================================= */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getSchemesDashboard() {
        Map<String, Object> result = new Map<String, Object>();
        List<SchemeWrapper> topSchemes = new List<SchemeWrapper>();
        List<String> colors = new List<String>{
            '#4CAF50', '#2196F3', '#FF9800', '#F44336', '#9C27B0', '#00BCD4'
        };

        try {
            System.debug('=== Starting getSchemesDashboard ===');
            List<ibfsa__Scheme__c> schemes = [
                SELECT 
                    Id,
                    ibfsa__Scheme_Name__c,
                    ibfsa__Discount__c,
                    ibfsa__Description__c,
                    ibfsa__Threshold_Quantity__c,
                    ibfsa__Start_Date__c,
                    ibfsa__End_Date__c,
                    ibfsa__Active__c
                FROM ibfsa__Scheme__c
                WHERE ibfsa__Active__c = true
                ORDER BY ibfsa__Discount__c DESC
            ];
            
            System.debug('Total schemes found: ' + schemes.size());
            
            Integer totalCount = schemes.size();
            Integer colorIndex = 0;

            // Get top 3 schemes
            for (Integer i = 0; i < Math.min(3, schemes.size()); i++) {
                ibfsa__Scheme__c scheme = schemes.get(i);
                System.debug('Processing scheme: ' + scheme.ibfsa__Scheme_Name__c + ', Discount: ' + scheme.ibfsa__Discount__c);
                String color = colors.get(Math.mod(colorIndex, colors.size()));
                topSchemes.add(new SchemeWrapper(scheme, color));
                colorIndex++;
            }

            result.put('topSchemes', topSchemes);
            result.put('totalCount', totalCount);
            result.put('moreCount', Math.max(0, totalCount - 3));
            
            System.debug('Result: ' + result);

        } catch (Exception e) {
            System.debug('Error fetching schemes dashboard: ' + e.getMessage());
            System.debug('Stack trace: ' + e.getStackTraceString());
            throw new AuraHandledException('Unable to fetch schemes: ' + e.getMessage());
        }

        return result;
    }
}