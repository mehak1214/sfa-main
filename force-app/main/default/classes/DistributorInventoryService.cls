public with sharing class DistributorInventoryService {

    public static void processAccounts(
        List<Account> newList,
        Map<Id, Account> oldMap,
        Boolean isInsert,
        Boolean isUpdate
    ) {

        Set<Id> eligibleAccountIds = new Set<Id>();

        // STEP 1: Identify eligible Accounts
        for (Account acc : newList) {

            // New Dealer / Distributor
            if (isInsert && isDealerOrDistributor(acc)) {
                eligibleAccountIds.add(acc.Id);
            }

            // Existing Account updated to Dealer / Distributor
            if (isUpdate && oldMap != null) {
                Account oldAcc = oldMap.get(acc.Id);
                if (!isDealerOrDistributor(oldAcc) && isDealerOrDistributor(acc)) {
                    eligibleAccountIds.add(acc.Id);
                }
            }
        }

        if (eligibleAccountIds.isEmpty()) {
            return;
        }

        // STEP 2: Check existing inventories
        Map<Id, ibfsa__Inventory__c> existingInventoryMap =
            new Map<Id, ibfsa__Inventory__c>();

        for (ibfsa__Inventory__c inv : [
            SELECT Id, ibfsa__Dealer__c
            FROM ibfsa__Inventory__c
            WHERE ibfsa__Dealer__c IN :eligibleAccountIds
        ]) {
            existingInventoryMap.put(inv.ibfsa__Dealer__c, inv);
        }

        // STEP 3: Create missing Inventory headers
        List<ibfsa__Inventory__c> inventoriesToInsert =
            new List<ibfsa__Inventory__c>();

        for (Id accId : eligibleAccountIds) {
            if (!existingInventoryMap.containsKey(accId)) {
                inventoriesToInsert.add(new ibfsa__Inventory__c(
                    ibfsa__Dealer__c = accId,
                    Status__c = 'Active'
                ));
            }
        }

        if (inventoriesToInsert.isEmpty()) {
            return;
        }

        insert inventoriesToInsert;

        // STEP 4: Map Account to Inventory
        Map<Id, Id> accountToInventoryId = new Map<Id, Id>();
        for (ibfsa__Inventory__c inv : inventoriesToInsert) {
            accountToInventoryId.put(inv.ibfsa__Dealer__c, inv.Id);
        }

        // STEP 5: Fetch all active products
        List<Product2> products = [
            SELECT Id
            FROM Product2
            WHERE IsActive = true AND ibfsa__Is_Vashi_Product__c = true
        ];

        // STEP 6: Create Inventory Items
        List<ibfsa__Inventory_Item__c> inventoryItems =
            new List<ibfsa__Inventory_Item__c>();

        for (Id accId : accountToInventoryId.keySet()) {
            Id inventoryId = accountToInventoryId.get(accId);

            for (Product2 prod : products) {
                inventoryItems.add(new ibfsa__Inventory_Item__c(
                    ibfsa__Inventory__c = inventoryId,
                    ibfsa__Product__c = prod.Id,
                    ibfsa__AvailableStock__c = 2000,
                    ibfsa__MinimumThresholdQuantity__c = 1000
                ));
            }
        }

        if (!inventoryItems.isEmpty()) {
            insert inventoryItems;
        }
    }

    private static Boolean isDealerOrDistributor(Account acc) {
        return acc.RecordTypeId ==
            Schema.SObjectType.Account
                .getRecordTypeInfosByDeveloperName()
                .get('Dealer_Distributor')
                .getRecordTypeId();
    }
}