public with sharing class OutletLocationController {

    /* ============================
       Reverse Geocode (OpenStreetMap)
    ============================ */
    private static String reverseGeocode(Decimal lat, Decimal lon) {
        String address = 'Unknown Location';
        try {
            Http h = new Http();
            HttpRequest req = new HttpRequest();
            req.setEndpoint(
                'https://nominatim.openstreetmap.org/reverse' +
                '?format=jsonv2&lat=' + lat + '&lon=' + lon
            );
            req.setMethod('GET');
            req.setHeader('User-Agent', 'Salesforce');

            HttpResponse res = h.send(req);
            if (res.getStatusCode() == 200) {
                Map<String, Object> body =
                    (Map<String, Object>) JSON.deserializeUntyped(res.getBody());
                if (body.containsKey('display_name')) {
                    address = (String) body.get('display_name');
                }
            }
        } catch (Exception e) {
            System.debug('Reverse Geocode Error: ' + e.getMessage());
        }
        return address;
    }

    /* ============================
       Save Outlet Location
    ============================ */
    @AuraEnabled
    public static void saveOutletLocation(
        Id outletId,
        Decimal latitude,
        Decimal longitude
    ) {
        if (outletId == null || latitude == null || longitude == null) {
            throw new AuraHandledException('Outlet Id and coordinates required');
        }

        Outlet__c outlet = [
            SELECT Id
            FROM Outlet__c
            WHERE Id = :outletId
            LIMIT 1
        ];

        //  Store in GEOLOCATION FIELD
        outlet.ibfsa__Outlet_Location__Latitude__s  = latitude;
        outlet.ibfsa__Outlet_Location__Longitude__s = longitude;

        //  Store formatted address (TEXT FIELD)
        outlet.ibfsa__Addresss__c = reverseGeocode(latitude, longitude);

        //  SAFE UPDATE (prevents duplicate-rule crash)
        Database.update(outlet, false);
    }
}