public with sharing class ProductGridController {

    @AuraEnabled(cacheable=true)
    public static List<Product2> getAllProducts() {
        return [
            SELECT Id, Name, Description, Family, IsActive, 
                   CreatedDate, LastModifiedDate
            FROM Product2
            WHERE IsActive = true
            ORDER BY CreatedDate DESC
            LIMIT 100
        ];
    }

    @AuraEnabled(cacheable=true)
    public static Product2 getProductById(Id productId) {
        List<Product2> products = [
            SELECT Id, Name, Description, Family, IsActive, 
                   CreatedDate, LastModifiedDate
            FROM Product2
            WHERE Id = :productId
            LIMIT 1
        ];
        return products.isEmpty() ? null : products[0];
    }
}