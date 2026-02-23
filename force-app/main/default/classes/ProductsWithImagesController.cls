public with sharing class ProductsWithImagesController {
    
    /**
     * Fetches all Product2 records with their associated Attachments
     * @return List of products with image data
     */
    @AuraEnabled(cacheable=true)
    public static List<ProductWrapper> getProductsWithImages() {
        List<ProductWrapper> products = new List<ProductWrapper>();
        
        try {
            // Query all Product2 records
            List<Product2> productList = [
                SELECT Id, Name, Description, Family, ProductCode
                  FROM Product2
                 WHERE IsActive = true
                       AND ibfsa__Is_New__c = true
                ORDER BY Name ASC
            ];
            
            // Get all product IDs for bulk content query
            Set<Id> productIds = new Set<Id>();
            for (Product2 product : productList) {
                productIds.add(product.Id);
            }
            
            // Query ContentVersion through ContentDocumentLink (modern Salesforce files)
            List<ContentDocumentLink> contentLinks = [
                SELECT ContentDocumentId, LinkedEntityId, ContentDocument.LatestPublishedVersionId
                  FROM ContentDocumentLink
                 WHERE LinkedEntityId IN :productIds
                       AND ContentDocument.FileType IN ('JPG', 'JPEG', 'PNG', 'GIF', 'WEBP')
                 LIMIT 10000
            ];
            
            // Map to store first content version per product
            Map<Id, String> contentVersionByProductId = new Map<Id, String>();
            for (ContentDocumentLink link : contentLinks) {
                if (!contentVersionByProductId.containsKey(link.LinkedEntityId)) {
                    contentVersionByProductId.put(link.LinkedEntityId, link.ContentDocument.LatestPublishedVersionId);
                }
            }
            
            // Query legacy Attachments as fallback
            List<Attachment> allAttachments = [
                SELECT Id, Name, ContentType, ParentId
                  FROM Attachment
                 WHERE ParentId IN :productIds
            ];
            
            // Map attachments by ProductId
            Map<Id, Attachment> attachmentsByProductId = new Map<Id, Attachment>();
            for (Attachment attachment : allAttachments) {
                if (!attachmentsByProductId.containsKey(attachment.ParentId)) {
                    attachmentsByProductId.put(attachment.ParentId, attachment);
                }
            }
            
            // Create wrappers by iterating products and looking up either ContentVersion or Attachment
            for (Product2 product : productList) {
                ProductWrapper wrapper = new ProductWrapper();
                wrapper.productId = product.Id;
                wrapper.productName = product.Name;
                wrapper.description = product.Description;
                wrapper.family = product.Family;
                wrapper.productCode = product.ProductCode;
                
                // Try ContentVersion first (modern approach)
                if (contentVersionByProductId.containsKey(product.Id)) {
                    String contentVersionId = contentVersionByProductId.get(product.Id);
                    wrapper.attachmentId = contentVersionId;
                    wrapper.imageUrl = '/sfc/servlet.shepherd/version/download/' + contentVersionId;
                }
                // Fallback to Attachment if no ContentVersion found
                else if (attachmentsByProductId.containsKey(product.Id)) {
                    Attachment attachment = attachmentsByProductId.get(product.Id);
                    wrapper.attachmentId = attachment.Id;
                    wrapper.attachmentName = attachment.Name;
                    wrapper.imageUrl = '/sfc/servlet.shepherd/attachment/' + attachment.Id;
                }
                
                products.add(wrapper);
            }
            
        } catch (Exception e) {
            System.debug('Error fetching products with images: ' + e.getMessage());
            throw new AuraHandledException('Unable to fetch products: ' + e.getMessage());
        }
        
        return products;
    }
    
    /**
     * Wrapper class to hold product and image data
     */
    public class ProductWrapper {
        @AuraEnabled
        public String productId { get; set; }
        
        @AuraEnabled
        public String productName { get; set; }
        
        @AuraEnabled
        public String description { get; set; }
        
        @AuraEnabled
        public String family { get; set; }
        
        @AuraEnabled
        public String productCode { get; set; }
        
        @AuraEnabled
        public String attachmentId { get; set; }
        
        @AuraEnabled
        public String attachmentName { get; set; }
        
        @AuraEnabled
        public String imageUrl { get; set; }
    }
}