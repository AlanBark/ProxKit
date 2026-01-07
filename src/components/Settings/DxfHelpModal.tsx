import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
import silhouetteStudioSettings from '../../assets/sillhouette-studio-settings.png';
import silhouetteSettings2 from '../../assets/sillhouette-studio-settings-2.png';

interface DxfHelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

function DxfHelpModal({ isOpen, onClose }: DxfHelpModalProps) {
    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose}
            scrollBehavior="inside"
            size="5xl"
        >
            <ModalContent>
                <ModalHeader>Importing DXF Paths into Silhouette Studio</ModalHeader>
                <ModalBody>
                    <div className="space-y-4">
                        <p className="text-sm text-default-600">
                            Silhouette Studio Free Tier only allows DXF imports for paths. Unfortunately DXF imports do not work well out of the box.
                        </p>

                        <div className="flex flex-col gap-6">
                            <div>
                                <h3 className="font-semibold mb-2">Step 1: Configure Import Settings</h3>
                                <p className="text-sm text-default-600 mb-3">
                                    Go to <strong>Edit → Preferences → Import → DXF</strong> and change the 'Open' option from <strong>Fit-to-Page</strong> to <strong>As-Is</strong>
                                </p>
                                <img
                                    src={silhouetteStudioSettings}
                                    alt="Silhouette Studio DXF Import Settings"
                                    className="w-full max-w-md mx-auto rounded-lg border border-default-200"
                                />
                            </div>

                            <div>
                                <h3 className="font-semibold mb-2">Step 2: Import the DXF File</h3>
                                <p className="text-sm text-default-600">
                                    Drag the DXF file onto the Silhouette Studio canvas
                                </p>
                            </div>

                            <div>
                                <h3 className="font-semibold mb-2">Step 3: Align the Cut Paths</h3>
                                <p className="text-sm text-default-600 mb-3">
                                    Move the cut lines to be centered on the page.
                                </p>
                                <p className="text-sm text-default-600 mb-3">
                                    Alternatively, set the X and Y values of the imported DXF file to be 0,0:
                                    </p>
                                <img
                                    src={silhouetteSettings2}
                                    alt="Silhouette Studio Alignment Controls"
                                    className="w-full  mx-auto rounded-lg border border-default-200"
                                />
                            </div>
                        </div>
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

export default DxfHelpModal;