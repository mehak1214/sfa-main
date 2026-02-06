trigger AccountInventoryTrigger on Account (after insert, after update) {
    DistributorInventoryService.processAccounts(
        Trigger.new,
        Trigger.oldMap,
        Trigger.isInsert,
        Trigger.isUpdate
    );
}