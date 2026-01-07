import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';

interface XmlHelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function XmlHelpModal({ isOpen, onClose }: XmlHelpModalProps) {
    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            scrollBehavior="inside"
            size="5xl"
            className='border-1'
        >
            <ModalContent>
                <ModalHeader>MPCFill XML Import</ModalHeader>
                <ModalBody>
                    <div className="space-y-4">
                        <p><a className='underline text-primary' href='https://mpcfill.com/' target='_blank'>MPC AutoFill</a> is an amazing site created by members of the MTG Proxy community.</p>
                        <p>They host high quality, community made proxy images, which can then be imported to ProxKit.</p>
                        <p>Once you've finished a project, click 'Download' → 'XML'. This is the XML to be uploaded.</p>
                        <p>ProxKit will not feature any MPC Autofill integration beyond this.</p>
                    </div>
                </ModalBody>
                <ModalFooter>
                    <Button color="primary" onPress={onClose}>
                        Close
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}

export default XmlHelpModal;
