<?php

declare(strict_types=1);

namespace Technimark\CarrierAccounts\Setup\Patch\Data;

use Magento\Customer\Model\Customer;
use Magento\Customer\Setup\CustomerSetupFactory;
use Magento\Eav\Model\Entity\Attribute\SetFactory as AttributeSetFactory;
use Magento\Framework\Setup\ModuleDataSetupInterface;
use Magento\Framework\Setup\Patch\DataPatchInterface;

class AddCarrierAccountsToForms implements DataPatchInterface
{
    private ModuleDataSetupInterface $moduleDataSetup;
    private CustomerSetupFactory $customerSetupFactory;
    private AttributeSetFactory $attributeSetFactory;

    public function __construct(
        ModuleDataSetupInterface $moduleDataSetup,
        CustomerSetupFactory $customerSetupFactory,
        AttributeSetFactory $attributeSetFactory
    ) {
        $this->moduleDataSetup = $moduleDataSetup;
        $this->customerSetupFactory = $customerSetupFactory;
        $this->attributeSetFactory = $attributeSetFactory;
    }

    public function apply(): self
    {
        $customerSetup = $this->customerSetupFactory->create(['setup' => $this->moduleDataSetup]);

        $attribute = $customerSetup->getEavConfig()
            ->getAttribute(Customer::ENTITY, 'saved_carrier_accounts');

        if (!$attribute || !$attribute->getId()) {
            return $this;
        }

        // Assign to default attribute set and group
        $customerEntity = $customerSetup->getEavConfig()->getEntityType(Customer::ENTITY);
        $setId = $customerEntity->getDefaultAttributeSetId();
        $attributeSet = $this->attributeSetFactory->create();
        $groupId = $attributeSet->getDefaultGroupId($setId);

        $attribute->setData('attribute_set_id', $setId);
        $attribute->setData('attribute_group_id', $groupId);

        // Add to forms so REST API can read/write it
        $attribute->setData('used_in_forms', [
            'adminhtml_customer',
            'customer_account_create',
            'customer_account_edit',
        ]);

        $attribute->save();

        return $this;
    }

    public static function getDependencies(): array
    {
        return [AddSavedCarrierAccountsAttribute::class];
    }

    public function getAliases(): array
    {
        return [];
    }
}
