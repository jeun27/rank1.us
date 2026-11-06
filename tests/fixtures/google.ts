// Synthetic Google API responses (Example data only), shaped like the documented responses:
// - accounts.list: https://developers.google.com/my-business/reference/accountmanagement/rest/v1/accounts/list
// - accounts.locations.list / locations.get / getAttributes / patch / updateAttributes:
//   https://developers.google.com/my-business/reference/businessinformation/rest/v1/accounts.locations
// - sites.list: https://developers.google.com/webmaster-tools/v1/sites/list
// - accountSummaries.list: https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/accountSummaries/list

export const accountsPage1 = {
  accounts: [{ name: "accounts/1000000000000000001", accountName: "Example Owner", type: "PERSONAL" }],
  nextPageToken: "page-2",
};
export const accountsPage2 = {
  accounts: [{ name: "accounts/1000000000000000002", accountName: "Example Restaurant Group", type: "LOCATION_GROUP" }],
};

export const locations = {
  locations: [
    {
      name: "locations/2000000000000000001",
      title: "Example Ramen House",
      storefrontAddress: { addressLines: ["1 Example St"], locality: "Irvine", administrativeArea: "CA" },
    },
    {
      name: "locations/2000000000000000002",
      title: "Example Ramen House Tustin",
      storefrontAddress: { addressLines: ["2 Example Ave"], locality: "Tustin", administrativeArea: "CA" },
    },
  ],
};

export const location = {
  name: "locations/2000000000000000001",
  profile: { description: "Example ramen in Irvine." },
  regularHours: {
    periods: [{ openDay: "MONDAY", openTime: { hours: 11 }, closeDay: "MONDAY", closeTime: { hours: 21 } }],
  },
  websiteUri: "https://example.com/",
  phoneNumbers: { primaryPhone: "(949) 555-0100", additionalPhones: ["(949) 555-0199"] },
};

export const attributes = {
  name: "locations/2000000000000000001/attributes",
  attributes: [
    { name: "attributes/has_delivery", valueType: "BOOL", values: [true] },
    { name: "attributes/has_wheelchair_accessible_entrance", valueType: "BOOL", values: [false] },
  ],
};

export const sites = {
  siteEntry: [
    { siteUrl: "https://example.com/", permissionLevel: "siteOwner" },
    { siteUrl: "sc-domain:example.com", permissionLevel: "siteFullUser" },
    { siteUrl: "https://example.net/", permissionLevel: "siteUnverifiedUser" },
  ],
};

export const accountSummaries = {
  accountSummaries: [
    {
      name: "accountSummaries/300000001",
      account: "accounts/300000001",
      displayName: "Example Ramen House",
      propertySummaries: [
        { property: "properties/400000001", displayName: "example.com", propertyType: "PROPERTY_TYPE_ORDINARY" },
      ],
    },
  ],
};
