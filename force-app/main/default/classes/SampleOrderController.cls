public with sharing class SampleOrderController {

    public class OrderResult {
        @AuraEnabled public String sampleOrderId;
        @AuraEnabled public String sampleOrderName;
    }

    @AuraEnabled
    public static OrderResult createSampleOrder(
        ibfsa__Sample_Order__c orderRec,
        Id parentId,
        List<ibfsa__Sample_Order_Line__c> lines
    ) {

        if (orderRec == null) {
            throw new AuraHandledException('Sample Order data is missing');
        }

        try {
            // Assign Customer (Account)
            if (parentId != null && parentId.getSObjectType() == Account.SObjectType) {
                orderRec.ibfsa__Customer__c = parentId;
            }

            // Default Status
            if (orderRec.ibfsa__Status__c == null) {
                orderRec.ibfsa__Status__c = 'Draft';
            }

            insert orderRec;

            if (lines != null && !lines.isEmpty()) {
                for (ibfsa__Sample_Order_Line__c line : lines) {
                    line.ibfsa__Sample_Order__c = orderRec.Id;
                }
                insert lines;
            }

            OrderResult res = new OrderResult();
            res.sampleOrderId = orderRec.Id;
            res.sampleOrderName = orderRec.Name;
            return res;

        } catch (Exception e) {
            throw new AuraHandledException(e.getMessage());
        }
    }

    // Picklist loader
    @AuraEnabled(cacheable=true)
    public static List<String> getPicklistValues(String objectApiName, String fieldApiName) {
        Schema.DescribeFieldResult d =
            Schema.getGlobalDescribe()
                  .get(objectApiName)
                  .getDescribe()
                  .fields.getMap()
                  .get(fieldApiName)
                  .getDescribe();

        List<String> values = new List<String>();
        for (Schema.PicklistEntry pe : d.getPicklistValues()) {
            values.add(pe.getValue());
        }
        return values;
    }

    // Sample Products
    @AuraEnabled(cacheable=true)
    public static List<Product2> getSampleProducts() {
        return [
            SELECT Id, Name
            FROM Product2
            WHERE IsActive = true
            ORDER BY Name
        ];
    }
}