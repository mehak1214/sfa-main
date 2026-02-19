public with sharing class PlaceOrderController {


/* =========================================================
   WRAPPERS
   ========================================================= */

public class ProductOrderWrapper {
    @AuraEnabled public Id productId;
    @AuraEnabled public String productName;
    @AuraEnabled public String imageUrl;
    @AuraEnabled public Integer quantity;
    @AuraEnabled public Decimal unitPrice;
}


/* =========================================================
   LOAD FRANCHISE
   ========================================================= */
@AuraEnabled(cacheable=true)
public static List<Account> getFranchiseAccounts() {
    return [
        SELECT Id, Name
        FROM Account
        WHERE RecordType.DeveloperName = 'Franchise'
        ORDER BY Name
    ];
}


/* =========================================================
   LOAD DISTRIBUTOR
   ========================================================= */
@AuraEnabled(cacheable=true)
public static List<Account> getDistributorAccounts() {
    return [
        SELECT Id, Name
        FROM Account
        WHERE RecordType.DeveloperName = 'Dealer_Distributor'
        ORDER BY Name
    ];
}


/* =========================================================
   LOAD PRODUCTS BY DISTRIBUTOR
   ========================================================= */
@AuraEnabled(cacheable=true)
public static List<ProductOrderWrapper> getProductsByDistributor(Id distributorId) {

    if (distributorId == null) {
        return new List<ProductOrderWrapper>();
    }

    List<ibfsa__Inventory_Item__c> inventoryItems = [
        SELECT ibfsa__Product__c
        FROM ibfsa__Inventory_Item__c
        WHERE ibfsa__Inventory__c IN (
            SELECT Id FROM ibfsa__Inventory__c
            WHERE ibfsa__Dealer__c = :distributorId
        )
        AND ibfsa__Product__c != null
    ];

    Set<Id> productIds = new Set<Id>();
    for (ibfsa__Inventory_Item__c item : inventoryItems) {
        productIds.add(item.ibfsa__Product__c);
    }

    if (productIds.isEmpty()) {
        return new List<ProductOrderWrapper>();
    }

    List<Product2> products = [
        SELECT Id, Name
        FROM Product2
        WHERE Id IN :productIds
        AND IsActive = true
    ];

    Map<Id, Decimal> priceMap = new Map<Id, Decimal>();

    for (PricebookEntry pbe : [
        SELECT Product2Id, UnitPrice
        FROM PricebookEntry
        WHERE Product2Id IN :productIds
        AND IsActive = true
        AND Pricebook2.IsStandard = true
    ]) {
        priceMap.put(pbe.Product2Id, pbe.UnitPrice);
    }

    List<ProductOrderWrapper> result = new List<ProductOrderWrapper>();

    for (Product2 p : products) {
        ProductOrderWrapper w = new ProductOrderWrapper();
        w.productId = p.Id;
        w.productName = p.Name;
        w.quantity = 0;
        w.unitPrice = priceMap.get(p.Id);
        result.add(w);
    }

    return result;
}


/* =========================================================
   PLACE ORDER FULL FLOW
   ========================================================= */
@AuraEnabled
public static Id placeOrderFull(

    Id franchiseId,
    Id distributorId,
    List<Map<String,Object>> selectedProducts,

    String billingStreet,
    String billingCity,
    String billingState,
    String billingPostal,

    String shippingStreet,
    String shippingCity,
    String shippingState,
    String shippingPostal,

    Id billToContactId,
    Id shipToContactId,

    Decimal paymentAmount,
    String paymentMode
) {

    if(franchiseId == null) {
        throw new AuraHandledException('Franchise required');
    }

    if(selectedProducts == null || selectedProducts.isEmpty()) {
        throw new AuraHandledException('Select at least one product');
    }


    /* =========================
       STANDARD PRICEBOOK
       ========================= */

    Id stdPricebookId;

    if (Test.isRunningTest()) {
        stdPricebookId = Test.getStandardPricebookId();
    } else {
        stdPricebookId = [
            SELECT Id FROM Pricebook2
            WHERE IsStandard = true
            LIMIT 1
        ].Id;
    }


    /* =========================
       PRICEBOOK ENTRY MAP
       ========================= */

    Set<Id> productIds = new Set<Id>();

    for(Map<String,Object> m : selectedProducts) {
        productIds.add((Id)m.get('productId'));
    }

    Map<Id, PricebookEntry> pbeMap = new Map<Id, PricebookEntry>([
        SELECT Id, Product2Id, UnitPrice
        FROM PricebookEntry
        WHERE Product2Id IN :productIds
        AND Pricebook2Id = :stdPricebookId
        AND IsActive = true
    ]);


    /* =========================
       CONTRACT
       ========================= */

    Contract con = new Contract(
        AccountId = franchiseId,
        StartDate = Date.today(),
        ContractTerm = 30
    );
    insert con;


    /* =========================
       ORDER
       ========================= */

    Order ord = new Order(
        AccountId = franchiseId,
        EffectiveDate = Date.today(),
        Status = 'Draft',
        ContractId = con.Id,
        Pricebook2Id = stdPricebookId,

        BillingStreet = billingStreet,
        BillingCity = billingCity,
        BillingState = billingState,
        BillingPostalCode = billingPostal,

        ShippingStreet = shippingStreet,
        ShippingCity = shippingCity,
        ShippingState = shippingState,
        ShippingPostalCode = shippingPostal,

        BillToContactId = billToContactId,
        ShipToContactId = shipToContactId
    );

    if(distributorId != null){
        ord.put('ibfsa__Dealer_Distributer__c', distributorId);
    }

    insert ord;


    /* =========================
       ORDER ITEMS
       ========================= */

    List<OrderItem> items = new List<OrderItem>();
    Decimal totalAmount = 0;

    for(Map<String,Object> m : selectedProducts){

        Id prodId = (Id)m.get('productId');
        Integer qty = Integer.valueOf(String.valueOf(m.get('quantity')));
        Decimal price = Decimal.valueOf(String.valueOf(m.get('unitPrice')));

        PricebookEntry pbe = pbeMap.get(prodId);

        if(pbe == null) continue;

        OrderItem oi = new OrderItem(
            OrderId = ord.Id,
            PricebookEntryId = pbe.Id,
            Quantity = qty,
            UnitPrice = price
        );

        totalAmount += qty * price;
        items.add(oi);
    }

    if(items.isEmpty()){
        throw new AuraHandledException('No valid products found');
    }

    insert items;


    /* =========================
       PAYMENT CALCULATION
       ========================= */

    Decimal paid = paymentAmount == null ? 0 : paymentAmount;
    Decimal balance = totalAmount - paid;

    String payStatus;

    if(paid <= 0){
        payStatus = 'Pending';
    }
    else if(balance > 0){
        payStatus = 'Partially Paid';
    }
    else{
        payStatus = 'Paid';
    }


    /* =========================
       PAYMENT RECORD
       ========================= */

    if(paid > 0){

        Payment pay = new Payment();

        pay.AccountId = franchiseId;
        pay.Amount = paid;
        pay.Status = 'Processed';
        pay.Type = 'Sale';
        pay.EffectiveDate = Date.today();

        // custom fields
        pay.put('Order__c', ord.Id);
        pay.put('Payment_Mode__c', paymentMode);

        insert pay;
    }


    /* =========================
       UPDATE ORDER PAYMENT
       ========================= */

    ord.put('Payment_Status__c', payStatus);
    ord.put('Total_Paid_Amount__c', paid);
    ord.put('Outstanding_Amount__c', balance);

    update ord;


    /* =========================
       INVENTORY UPDATE
       ========================= */

    if(distributorId != null && !productIds.isEmpty()) {

        List<ibfsa__Inventory_Item__c> invItems = [
            SELECT Id, ibfsa__Product__c, ibfsa__AvailableStock__c
            FROM ibfsa__Inventory_Item__c
            WHERE ibfsa__Inventory__c IN (
                SELECT Id FROM ibfsa__Inventory__c
                WHERE ibfsa__Dealer__c = :distributorId
            )
            AND ibfsa__Product__c IN :productIds
            FOR UPDATE
        ];

        Map<Id, ibfsa__Inventory_Item__c> invMap =
            new Map<Id, ibfsa__Inventory_Item__c>();

        for (ibfsa__Inventory_Item__c ii : invItems) {
            invMap.put(ii.ibfsa__Product__c, ii);
        }

        for(Map<String,Object> m : selectedProducts){

            Id prodId = (Id)m.get('productId');
            Integer qty = Integer.valueOf(String.valueOf(m.get('quantity')));

            if(invMap.containsKey(prodId)){

                ibfsa__Inventory_Item__c ii = invMap.get(prodId);

                Decimal avail = ii.ibfsa__AvailableStock__c == null
                    ? 0 : ii.ibfsa__AvailableStock__c;

                Decimal newAvail = avail - qty;

                if(newAvail < 0) newAvail = 0;

                ii.ibfsa__AvailableStock__c = newAvail;
            }
        }

        update invItems;
    }

    return ord.Id;
}


}